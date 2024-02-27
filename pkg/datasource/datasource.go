package datasource

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/strava-datasource/pkg/grafanaclient"
	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

const StravaAPIUrl = "https://www.strava.com/api/v3"
const StravaAPITokenUrl = "https://www.strava.com/api/v3/oauth/token"

const StravaApiQueryType = "stravaAPI"
const StravaAuthQueryType = "stravaAuth"

var ErrAlertingNotSupported = errors.New("alerting not supported")

type StravaDatasource struct {
	im      instancemgmt.InstanceManager
	dataDir string
	saToken string
	logger  log.Logger
}

// StravaDatasourceInstance stores state about a specific datasource
// and provides methods to make requests to the Strava API
type StravaDatasourceInstance struct {
	dsInfo        *backend.DataSourceInstanceSettings
	cache         *DSCache
	authCache     *DSAuthCache
	logger        log.Logger
	httpClient    *http.Client
	prefetcher    *StravaPrefetcher
	saToken       string
	grafanaClient grafanaclient.GrafanaHTTPClient
}

func NewStravaDatasource(dataDir string, saToken string) *StravaDatasource {
	im := datasource.NewInstanceManager(newInstanceWithDataDir(dataDir, saToken))
	return &StravaDatasource{
		im:      im,
		dataDir: dataDir,
		saToken: saToken,
		logger:  log.New(),
	}
}

func newInstanceWithDataDir(dataDir string, saToken string) func(context.Context, backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return newStravaDatasourceInstance(ctx, settings, dataDir, saToken)
	}
}

// newStravaDatasourceInstance returns an initialized datasource instance
func newStravaDatasourceInstance(ctx context.Context, settings backend.DataSourceInstanceSettings, dataDir string, saToken string) (instancemgmt.Instance, error) {
	logger := log.New()
	logger.Debug("Initializing new data source instance")

	settingsDTO := &StravaDatasourceSettingsDTO{}
	err := json.Unmarshal(settings.JSONData, settingsDTO)
	if err != nil {
		return nil, fmt.Errorf("cannot read data source settings: %w", err)
	}

	if settingsDTO.CacheTTL == "" {
		settingsDTO.CacheTTL = "1h"
	}

	cacheTTL, err := gtime.ParseInterval(settingsDTO.CacheTTL)
	if err != nil {
		log.DefaultLogger.Warn("Cannot read cache TTL", "error", err)
	}

	grafanaClient, err := grafanaclient.NewGrafanaHTTPClient(ctx, settings, saToken)
	if err != nil {
		return nil, fmt.Errorf("cannot create grafana client: %w", err)
	}

	dsInstance := &StravaDatasourceInstance{
		dsInfo:        &settings,
		logger:        logger,
		cache:         NewDSCache(&settings, cacheTTL, 10*time.Minute, dataDir),
		authCache:     GetDSAuthCache(settings.ID),
		saToken:       saToken,
		grafanaClient: grafanaClient,
		httpClient: &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					Renegotiation: tls.RenegotiateFreelyAsClient,
				},
				Proxy: http.ProxyFromEnvironment,
				Dial: (&net.Dialer{
					Timeout:   30 * time.Second,
					KeepAlive: 30 * time.Second,
				}).Dial,
				TLSHandshakeTimeout:   10 * time.Second,
				ExpectContinueTimeout: 1 * time.Second,
				MaxIdleConns:          100,
				IdleConnTimeout:       90 * time.Second,
			},
			Timeout: time.Duration(time.Second * 30),
		},
	}

	oauthPassThru := isOAuthPassThruEnabled(dsInstance)
	if !oauthPassThru {
		// Initialize and run prefetcher
		prefetcher := NewStravaPrefetcher(5, dsInstance)
		dsInstance.prefetcher = prefetcher
		go func() {
			dsInstance.prefetcher.Run()
		}()
	}

	return dsInstance, nil
}

// getDSInstance Returns cached datasource or creates new one
func (ds *StravaDatasource) getDSInstance(ctx context.Context, pluginContext backend.PluginContext) (*StravaDatasourceInstance, error) {
	instance, err := ds.im.Get(ctx, pluginContext)
	if err != nil {
		return nil, err
	}
	return instance.(*StravaDatasourceInstance), nil
}

func (ds *StravaDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	qdr := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		res := backend.DataResponse{}
		res.Error = ErrAlertingNotSupported
		qdr.Responses[q.RefID] = res
	}

	return qdr, nil
}

// CheckHealth checks if the plugin is running properly
func (ds *StravaDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	res := &backend.CheckHealthResult{}

	_, err := ds.getDSInstance(ctx, req.PluginContext)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = "Error getting datasource instance"
		ds.logger.Error("Error getting datasource instance", "err", err)
		return res, nil
	}

	// TODO: implement real API health check
	res.Status = backend.HealthStatusOk
	res.Message = "Plugin up and running"
	return res, nil
}

func (ds *StravaDatasourceInstance) StravaAuthQuery(ctx context.Context, req *StravaAuthRequest) (*StravaAuthResourceResponse, error) {
	ds.logger.Debug("Performing authentication")
	authCode := req.AuthCode
	_, err := ds.ExchangeToken(authCode)
	if err != nil {
		return nil, err
	}

	tokenExchangeResp := map[string]string{
		"message": "Authorization code successfully exchanged for refresh token",
	}

	response := &StravaAuthResourceResponse{
		Result: tokenExchangeResp,
	}
	return response, nil
}

func (ds *StravaDatasourceInstance) GetAccessToken() (string, error) {
	accessToken, expTime, found := ds.cache.gocache.GetWithExpiration("accessToken")
	accessTokenExpired := time.Now().After(expTime)
	if found && !accessTokenExpired {
		return accessToken.(string), nil
	} else if found && accessTokenExpired {
		ds.logger.Debug("Access token expired, obtaining new one")
	}

	refreshToken, err := ds.GetRefreshToken()
	if err != nil {
		return "", err
	}

	tokenResp, err := ds.RefreshAccessToken(refreshToken)
	if err != nil {
		ds.logger.Error(err.Error())
		return "", err
	}

	return tokenResp.AccessToken, nil
}

func (ds *StravaDatasourceInstance) GetRefreshToken() (string, error) {
	secureJsonData := ds.dsInfo.DecryptedSecureJSONData
	refreshToken := secureJsonData["refreshToken"]
	ds.logger.Debug("Got refresh token from secureJsonData")

	if refreshToken == "" {
		ds.logger.Error("Error loading refresh token")
		return "", errors.New("Refresh token not found, authorize datasource first")
	}
	return refreshToken, nil
}

func (ds *StravaDatasourceInstance) SaveRefreshToken(token string) error {
	ds.logger.Debug("saving refresh token")
	res, err := ds.grafanaClient.Get(fmt.Sprintf("/api/datasources/uid/%s", ds.dsInfo.UID))
	if err != nil {
		return err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)

	jsonData := make(map[string]any)
	err = json.Unmarshal(body, &jsonData)
	if err != nil {
		return err
	}
	secureJsonData := make(map[string]string)
	secureJsonData["refreshToken"] = token
	jsonData["secureJsonData"] = secureJsonData

	updatedData, err := json.Marshal(jsonData)
	if err != nil {
		return err
	}

	reqData := bytes.NewReader(updatedData)
	updateRes, err := ds.grafanaClient.DoRequest("PUT", fmt.Sprintf("/api/datasources/uid/%s", ds.dsInfo.UID), reqData)
	if err != nil {
		return err
	}
	ds.logger.Debug("data source updated", "status", updateRes.Status)

	return nil
}

// ExchangeToken invokes first time when authentication required and exchange authorization code for the
// access and refresh tokens
// https://developers.strava.com/docs/authentication/#tokenexchange
func (ds *StravaDatasourceInstance) ExchangeToken(authCode string) (*TokenExchangeResponse, error) {
	jsonDataStr := ds.dsInfo.JSONData
	jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
	if err != nil {
		return nil, err
	}
	clientId := jsonData.Get("clientID").MustString()

	secureJsonData := ds.dsInfo.DecryptedSecureJSONData
	clientSecret := secureJsonData["clientSecret"]

	authParams := map[string][]string{
		"client_id":     {clientId},
		"client_secret": {clientSecret},
		"code":          {authCode},
		"grant_type":    {"authorization_code"},
	}

	authResp, err := ds.httpClient.PostForm(StravaAPITokenUrl, authParams)
	if err != nil {
		return nil, err
	} else if authResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Auth error, status: %v", authResp.Status)
	}

	defer authResp.Body.Close()
	body, err := io.ReadAll(authResp.Body)
	if err != nil {
		return nil, err
	}

	respJson, err := simplejson.NewJson(body)
	if err != nil {
		return nil, err
	}

	accessToken := respJson.Get("access_token").MustString()
	accessTokenExpAt := respJson.Get("expires_at").MustInt64()
	accessTokenExpIn := time.Until(time.Unix(accessTokenExpAt, 0))
	refreshToken := respJson.Get("refresh_token").MustString()
	ds.logger.Debug("Got new refresh token")

	ds.cache.SetWithExpiration("accessToken", accessToken, accessTokenExpIn)
	err = ds.SaveRefreshToken(refreshToken)
	if err != nil {
		ds.logger.Error("Error saving refresh token", "err", err)
	}

	return &TokenExchangeResponse{
		AccessToken:      accessToken,
		AccessTokenExpAt: accessTokenExpAt,
		RefreshToken:     refreshToken,
	}, nil
}

// RefreshAccessToken refreshes expired Access token using refresh token
// https://developers.strava.com/docs/authentication/#refreshingexpiredaccesstokens
func (ds *StravaDatasourceInstance) RefreshAccessToken(refreshToken string) (*TokenExchangeResponse, error) {
	jsonDataStr := ds.dsInfo.JSONData
	jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
	if err != nil {
		return nil, err
	}
	clientId := jsonData.Get("clientID").MustString()

	secureJsonData := ds.dsInfo.DecryptedSecureJSONData
	clientSecret := secureJsonData["clientSecret"]

	authParams := map[string][]string{
		"client_id":     {clientId},
		"client_secret": {clientSecret},
		"refresh_token": {refreshToken},
		"grant_type":    {"refresh_token"},
	}

	authResp, err := ds.httpClient.PostForm(StravaAPITokenUrl, authParams)
	if err != nil {
		return nil, err
	}
	if authResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Token exchange failed: %v", authResp.Status)
	}

	defer authResp.Body.Close()
	body, err := io.ReadAll(authResp.Body)
	if err != nil {
		return nil, err
	}

	respJson, err := simplejson.NewJson(body)
	if err != nil {
		return nil, err
	}

	accessToken := respJson.Get("access_token").MustString()
	accessTokenExpAt := respJson.Get("expires_at").MustInt64()
	accessTokenExpIn := time.Until(time.Unix(accessTokenExpAt, 0))
	refreshTokenNew := respJson.Get("refresh_token").MustString()

	ds.cache.SetWithExpiration("accessToken", accessToken, accessTokenExpIn)
	if refreshTokenNew != refreshToken {
		ds.logger.Debug("Got new refresh token")

		err := ds.SaveRefreshToken(refreshToken)
		if err != nil {
			ds.logger.Error("Error saving refresh token", "err", err)
		}
	}

	return &TokenExchangeResponse{
		AccessToken:      accessToken,
		AccessTokenExpAt: accessTokenExpAt,
		RefreshToken:     refreshTokenNew,
	}, nil
}

func (ds *StravaDatasourceInstance) ResetAccessToken() error {
	ds.cache.Delete("accessToken")
	ds.logger.Debug("Access token removed from cache")
	return nil
}

func (ds *StravaDatasourceInstance) ResetCache() {
	ds.cache.Flush()
	ds.logger.Info("Cache has been reset", "data source", ds.dsInfo.Name)
}

func (ds *StravaDatasourceInstance) StravaAPIQueryWithCache(requestHash string) func(context.Context, *StravaAPIRequest) (*StravaApiResourceResponse, error) {
	cachedEndpointsPattern := regexp.MustCompile(`activities/\d+|athlete|segments/\d`)
	return func(ctx context.Context, query *StravaAPIRequest) (*StravaApiResourceResponse, error) {
		if cachedEndpointsPattern.MatchString(query.Endpoint) || query.Endpoint == "athlete/activities" {
			cachedResponse, found := ds.cache.Get(requestHash)
			if found {
				apiResponse, ok := cachedResponse.(*StravaApiResourceResponse)
				if ok {
					return apiResponse, nil
				} else {
					ds.logger.Error("Cannot get value from cache, type assertion failed")
				}
			}
			response, err := ds.StravaAPIQuery(ctx, query)
			if err != nil {
				return nil, err
			}
			if query.Endpoint == "athlete/activities" {
				ds.cache.Set(requestHash, response)
			} else {
				ds.cache.Set(requestHash, response)
			}
			return response, nil
		} else {
			return ds.StravaAPIQuery(ctx, query)
		}
	}
}

func (ds *StravaDatasourceInstance) StravaAPIQuery(ctx context.Context, query *StravaAPIRequest) (*StravaApiResourceResponse, error) {
	accessToken := ""
	var err error
	if query.AccessToken == "" {
		accessToken, err = ds.GetAccessToken()
		if err != nil {
			return nil, err
		}
	} else {
		accessToken = query.AccessToken
	}

	endpoint := query.Endpoint
	params := query.Params

	requestUrlStr := fmt.Sprintf("%s/%s", StravaAPIUrl, strings.TrimLeft(endpoint, "/"))
	requestUrl, err := url.Parse(requestUrlStr)
	if err != nil {
		return nil, err
	}

	q := requestUrl.Query()
	for param, value := range params {
		valueUnquoted, err := strconv.Unquote(string(value))
		if err != nil {
			valueUnquoted = string(value)
		}
		q.Add(param, valueUnquoted)
	}
	requestUrl.RawQuery = q.Encode()
	ds.logger.Debug("Strava API query", "url", requestUrl.String())

	req := &http.Request{
		Method: "GET",
		URL:    requestUrl,
		Header: map[string][]string{
			"Authorization": {"Bearer " + accessToken},
		},
	}

	apiResponse, err := makeHTTPRequest(ctx, ds.httpClient, req)
	if err != nil {
		return nil, err
	}

	return BuildAPIResponse(apiResponse)
}

func BuildAPIResponse(apiResponse []byte) (*StravaApiResourceResponse, error) {
	resultJson, err := simplejson.NewJson(apiResponse)
	if err != nil {
		return nil, err
	}

	result := resultJson.Interface()
	return &StravaApiResourceResponse{
		Result: result,
	}, nil
}

func makeHTTPRequest(ctx context.Context, httpClient *http.Client, req *http.Request) ([]byte, error) {
	res, err := ctxhttp.Do(ctx, httpClient, req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)

	if res.StatusCode >= 400 {
		return body, fmt.Errorf("Error status: %v", res.Status)
	}

	if err != nil {
		return nil, err
	}
	return body, nil
}
