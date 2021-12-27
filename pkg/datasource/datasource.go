package datasource

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"time"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	cache "github.com/patrickmn/go-cache"
	"golang.org/x/net/context/ctxhttp"
)

const StravaAPIUrl = "https://www.strava.com/api/v3"
const StravaAPITokenUrl = "https://www.strava.com/api/v3/oauth/token"

const StravaApiQueryType = "stravaAPI"
const StravaAuthQueryType = "stravaAuth"

var ErrAlertingNotSupported = errors.New("alerting not supported")

type StravaDatasource struct {
	im      instancemgmt.InstanceManager
	dataDir string
	logger  log.Logger
}

// StravaDatasourceInstance stores state about a specific datasource
// and provides methods to make requests to the Strava API
type StravaDatasourceInstance struct {
	dsInfo       *backend.DataSourceInstanceSettings
	refreshToken string
	cache        *DSCache
	logger       log.Logger
	httpClient   *http.Client
}

func NewStravaDatasource(dataDir string) *StravaDatasource {
	im := datasource.NewInstanceManager(newInstanceWithDataDir(dataDir))
	return &StravaDatasource{
		im:      im,
		dataDir: dataDir,
		logger:  log.New(),
	}
}

func newInstanceWithDataDir(dataDir string) func(backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return newStravaDatasourceInstance(settings, dataDir)
	}
}

// newStravaDatasourceInstance returns an initialized datasource instance
func newStravaDatasourceInstance(settings backend.DataSourceInstanceSettings, dataDir string) (instancemgmt.Instance, error) {
	logger := log.New()
	logger.Debug("Initializing new data source instance")

	return &StravaDatasourceInstance{
		dsInfo: &settings,
		logger: logger,
		cache:  NewDSCache(&settings, 10*time.Minute, 10*time.Minute, dataDir),
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
	}, nil
}

// getDSInstance Returns cached datasource or creates new one
func (ds *StravaDatasource) getDSInstance(pluginContext backend.PluginContext) (*StravaDatasourceInstance, error) {
	instance, err := ds.im.Get(pluginContext)
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

	_, err := ds.getDSInstance(req.PluginContext)
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
		ds.logger.Debug("Access token found in cache")
		return accessToken.(string), nil
	} else if found && accessTokenExpired {
		ds.logger.Debug("Access token expired, obtaining new one")
	}

	var refreshToken string
	var err error

	jsonDataStr := ds.dsInfo.JSONData
	jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
	if err != nil {
		return "", err
	}
	stravaAuthType := jsonData.Get("stravaAuthType").MustString()

	if stravaAuthType == "refresh_token" {
		ds.logger.Debug("Using preconfigured refresh token")
		secureJsonData := ds.dsInfo.DecryptedSecureJSONData
		refreshToken = secureJsonData["refreshToken"]
	} else {
		refreshTokenCached, found := ds.cache.Get("refreshToken")
		if !found {
			ds.logger.Debug("Loading refresh token from file")
			refreshToken, err = ds.cache.Load("refreshToken")
			if err != nil {
				ds.logger.Error(err.Error())
				return "", errors.New("Refresh token not found, authorize datasource first")
			}
			ds.logger.Debug("Refresh token loaded from file")
		} else {
			refreshToken = refreshTokenCached.(string)
		}
	}

	tokenResp, err := ds.RefreshAccessToken(refreshToken)
	if err != nil {
		ds.logger.Error(err.Error())
		return "", err
	}

	return tokenResp.AccessToken, nil
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
	if authResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Auth error, status: %v", authResp.Status)
	}

	defer authResp.Body.Close()
	body, err := ioutil.ReadAll(authResp.Body)
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

	ds.cache.Set("accessToken", accessToken, accessTokenExpIn)
	ds.cache.Set("refreshToken", refreshToken, cache.NoExpiration)

	err = ds.cache.Save("refreshToken", refreshToken)
	if err != nil {
		ds.logger.Error("Error saving refresh token", err)
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
	body, err := ioutil.ReadAll(authResp.Body)
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

	ds.cache.Set("accessToken", accessToken, accessTokenExpIn)
	if refreshTokenNew != refreshToken {
		ds.logger.Debug("Got new refresh token", "refresh token", refreshTokenNew)
		ds.cache.Set("refreshToken", refreshTokenNew, cache.NoExpiration)

		err := ds.cache.Save("refreshToken", refreshTokenNew)
		if err != nil {
			ds.logger.Error("Error saving refresh token", err)
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

func (ds *StravaDatasourceInstance) StravaAPIQuery(ctx context.Context, query *StravaAPIRequest) (*StravaApiResourceResponse, error) {
	accessToken, err := ds.GetAccessToken()
	if err != nil {
		return nil, err
	}

	endpoint := query.Endpoint
	params := query.Params

	requestUrlStr := fmt.Sprintf("%s/%s", StravaAPIUrl, endpoint)
	requestUrl, err := url.Parse(requestUrlStr)

	q := requestUrl.Query()
	for param, value := range params {
		q.Add(param, string(value))
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
	body, err := ioutil.ReadAll(res.Body)

	if res.StatusCode != http.StatusOK {
		return body, fmt.Errorf("Error status: %v", res.Status)
	}

	if err != nil {
		return nil, err
	}
	return body, nil
}
