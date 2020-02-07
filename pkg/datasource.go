package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"time"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	plugin "github.com/hashicorp/go-plugin"
	cache "github.com/patrickmn/go-cache"
	"golang.org/x/net/context/ctxhttp"
)

const StravaAPIUrl = "https://www.strava.com/api/v3"
const StravaAPITokenUrl = "https://www.strava.com/api/v3/oauth/token"

// StravaPlugin implements the Grafana backend interface and forwards queries to the StravaDatasource
type StravaPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	logger          hclog.Logger
	datasourceCache *Cache
	dataDir         string
}

// StravaDatasource stores state about a specific datasource and provides methods to make
// requests to the Zabbix API
type StravaDatasource struct {
	dsInfo       *datasource.DatasourceInfo
	refreshToken string
	cache        *Cache
	logger       hclog.Logger
	httpClient   *http.Client
}

// newStravaDatasource returns an initialized ZabbixDatasource
func newStravaDatasource(dsInfo *datasource.DatasourceInfo, dataDir string) (*StravaDatasource, error) {
	return &StravaDatasource{
		dsInfo: dsInfo,
		cache:  NewCache(10*time.Minute, 10*time.Minute, dataDir),
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

func (p *StravaPlugin) NewStravaDatasource(dsInfo *datasource.DatasourceInfo) (*StravaDatasource, error) {
	ds, err := newStravaDatasource(dsInfo, p.dataDir)
	if err != nil {
		return nil, err
	}

	ds.logger = p.logger
	return ds, nil
}

// Query receives requests from the Grafana backend. Requests are filtered by query type and sent to the
// applicable StravaDatasource.
func (p *StravaPlugin) Query(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (resp *datasource.DatasourceResponse, err error) {
	StravaDS, err := p.GetDatasource(tsdbReq)
	if err != nil {
		return nil, err
	}

	queryType, err := GetQueryType(tsdbReq)
	if err != nil {
		return nil, err
	}

	switch queryType {
	case "stravaAPI":
		resp, err = StravaDS.StravaAPIQuery(ctx, tsdbReq)
	case "stravaAuth":
		resp, err = StravaDS.StravaAuthQuery(ctx, tsdbReq)
	default:
		err = errors.New("Query not implemented")
		return BuildErrorResponse(err), nil
	}

	return
}

func (ds *StravaDatasource) StravaAuthQuery(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	ds.logger.Debug(tsdbReq.Queries[0].ModelJson)
	authQuery := tsdbReq.Queries[0]
	queryJSON, err := simplejson.NewJson([]byte(authQuery.ModelJson))
	if err != nil {
		return nil, err
	}
	authCode := queryJSON.Get("target").Get("params").Get("authCode").MustString()
	tokenExchangeResp, err := ds.ExchangeToken(tsdbReq, authCode)
	if err != nil {
		return nil, err
	}
	ds.logger.Debug(tokenExchangeResp.RefreshToken)
	tokenExchangeRespJson, err := json.Marshal(tokenExchangeResp)

	response := &datasource.DatasourceResponse{
		Results: []*datasource.QueryResult{
			&datasource.QueryResult{
				RefId:    "stravaAPI",
				MetaJson: string(tokenExchangeRespJson),
			},
		},
	}
	return response, nil
}

func (ds *StravaDatasource) GetAccessToken() (string, error) {
	accessToken, expTime, found := ds.cache.gocache.GetWithExpiration("accessToken")
	if found && time.Now().Before(expTime) {
		return accessToken.(string), nil
	}

	var refreshToken string
	var err error
	refreshTokenCached, found := ds.cache.Get("refreshToken")
	if !found {
		refreshToken, err = ds.cache.GetFromFile("refreshToken")
		if err != nil {
			return "", errors.New("Refresh token not found")
		}
	} else {
		refreshToken = refreshTokenCached.(string)
	}

	tokenResp, err := ds.RefreshAccessToken(refreshToken)
	if err != nil {
		return "", err
	}

	return tokenResp.AccessToken, nil
}

func (ds *StravaDatasource) ExchangeToken(tsdbReq *datasource.DatasourceRequest, authCode string) (*TokenExchangeResponse, error) {
	jsonDataStr := ds.dsInfo.GetJsonData()
	jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
	if err != nil {
		return nil, err
	}
	clientId := jsonData.Get("clientID").MustString()

	secureJsonData := ds.dsInfo.GetDecryptedSecureJsonData()
	clientSecret := secureJsonData["clientSecret"]

	ds.logger.Debug(authCode, clientId, clientSecret)

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
	ds.logger.Debug(refreshToken, accessToken)

	ds.cache.Set("accessToken", accessToken, accessTokenExpIn)
	ds.cache.Set("refreshToken", refreshToken, cache.NoExpiration)
	ds.cache.SaveToFile("refreshToken", refreshToken)

	return &TokenExchangeResponse{
		AccessToken:      accessToken,
		AccessTokenExpAt: accessTokenExpAt,
		RefreshToken:     refreshToken,
	}, nil
}

func (ds *StravaDatasource) RefreshAccessToken(refreshToken string) (*TokenExchangeResponse, error) {
	jsonDataStr := ds.dsInfo.GetJsonData()
	jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
	if err != nil {
		return nil, err
	}
	clientId := jsonData.Get("clientID").MustString()

	secureJsonData := ds.dsInfo.GetDecryptedSecureJsonData()
	clientSecret := secureJsonData["clientSecret"]

	authParams := map[string][]string{
		"client_id":     {clientId},
		"client_secret": {clientSecret},
		"refresh_token": {refreshToken},
		"grant_type":    {"refresh_token"},
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
	refreshTokenNew := respJson.Get("refresh_token").MustString()
	ds.logger.Debug(refreshTokenNew, accessToken)

	ds.cache.Set("accessToken", accessToken, accessTokenExpIn)
	if refreshTokenNew != refreshToken {
		ds.cache.Set("refreshToken", refreshTokenNew, cache.NoExpiration)
		ds.cache.SaveToFile("refreshToken", refreshTokenNew)
	}

	return &TokenExchangeResponse{
		AccessToken:      accessToken,
		AccessTokenExpAt: accessTokenExpAt,
		RefreshToken:     refreshTokenNew,
	}, nil
}

func (ds *StravaDatasource) StravaAPIQuery(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	accessToken, err := ds.GetAccessToken()
	if err != nil {
		return nil, err
	}

	ds.logger.Debug(accessToken)

	query := tsdbReq.Queries[0]
	queryJSON, err := simplejson.NewJson([]byte(query.ModelJson))
	if err != nil {
		return nil, err
	}
	endpoint := queryJSON.Get("target").Get("endpoint").MustString()
	params := queryJSON.Get("target").Get("params").MustMap()
	values := make(url.Values)
	for param, value := range params {
		values.Add(param, fmt.Sprint(value))
	}
	paramsEncoded := values.Encode()

	requestUrl := StravaAPIUrl + "/" + endpoint
	if paramsEncoded != "" {
		requestUrl += "?" + paramsEncoded
	}

	parsedUrl, err := url.Parse(requestUrl)
	if err != nil {
		return nil, err
	}

	req := &http.Request{
		Method: "GET",
		URL:    parsedUrl,
		Header: map[string][]string{
			"Authorization": {"Bearer " + accessToken},
		},
	}

	apiResponse, err := makeHTTPRequest(ctx, ds.httpClient, req)
	apiResponseStr := string(apiResponse)
	ds.logger.Debug(apiResponseStr)

	response := &datasource.DatasourceResponse{
		Results: []*datasource.QueryResult{
			&datasource.QueryResult{
				RefId:    "stravaAPI",
				MetaJson: apiResponseStr,
			},
		},
	}
	return response, nil
}

func makeHTTPRequest(ctx context.Context, httpClient *http.Client, req *http.Request) ([]byte, error) {
	res, err := ctxhttp.Do(ctx, httpClient, req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("invalid status code. status: %v", res.Status)
	}

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	return body, nil
}

// GetDatasource Returns cached datasource or creates new one
func (p *StravaPlugin) GetDatasource(tsdbReq *datasource.DatasourceRequest) (*StravaDatasource, error) {
	dsInfoHash := HashDatasourceInfo(tsdbReq.GetDatasource())

	if cachedData, ok := p.datasourceCache.Get(dsInfoHash); ok {
		if cachedDS, ok := cachedData.(*StravaDatasource); ok {
			return cachedDS, nil
		}
	}

	dsInfo := tsdbReq.GetDatasource()
	if p.logger.IsDebug() {
		p.logger.Debug(fmt.Sprintf("Datasource cache miss (Org %d Id %d '%s' %s)", dsInfo.GetOrgId(), dsInfo.GetId(), dsInfo.GetName(), dsInfoHash))
	}

	ds, err := p.NewStravaDatasource(dsInfo)
	if err != nil {
		return nil, err
	}

	p.datasourceCache.SetDefault(dsInfoHash, ds)
	return ds, nil
}

// GetQueryType determines the query type from a query or list of queries
func GetQueryType(tsdbReq *datasource.DatasourceRequest) (string, error) {
	queryType := "query"
	if len(tsdbReq.Queries) > 0 {
		firstQuery := tsdbReq.Queries[0]
		queryJSON, err := simplejson.NewJson([]byte(firstQuery.ModelJson))
		if err != nil {
			return "", err
		}
		queryType = queryJSON.Get("queryType").MustString("query")
	}
	return queryType, nil
}

// BuildResponse transforms a Strava API response to a DatasourceResponse
func BuildResponse(responseData interface{}) (*datasource.DatasourceResponse, error) {
	jsonBytes, err := json.Marshal(responseData)
	if err != nil {
		return nil, err
	}

	return &datasource.DatasourceResponse{
		Results: []*datasource.QueryResult{
			&datasource.QueryResult{
				RefId:    "StravaAPI",
				MetaJson: string(jsonBytes),
			},
		},
	}, nil
}

// BuildErrorResponse creates a QueryResult that forwards an error to the front-end
func BuildErrorResponse(err error) *datasource.DatasourceResponse {
	return &datasource.DatasourceResponse{
		Results: []*datasource.QueryResult{
			&datasource.QueryResult{
				RefId: "StravaAPI",
				Error: err.Error(),
			},
		},
	}
}
