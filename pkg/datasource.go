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
	cache "github.com/patrickmn/go-cache"
	"golang.org/x/net/context/ctxhttp"
)

const StravaAPIUrl = "https://www.strava.com/api/v3"
const StravaAPITokenUrl = "https://www.strava.com/api/v3/oauth/token"

// newStravaDatasource returns an initialized StravaDatasource instance
func newStravaDatasource(dsInfo *datasource.DatasourceInfo, dataDir string) (*StravaDatasource, error) {
	return &StravaDatasource{
		dsInfo: dsInfo,
		cache:  NewDSCache(dsInfo, 10*time.Minute, 10*time.Minute, dataDir),
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

	queryType, err := getQueryType(tsdbReq)
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
		return buildErrorResponse(err, nil), nil
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
	accessTokenExpired := time.Now().After(expTime)
	if found && !accessTokenExpired {
		return accessToken.(string), nil
	} else if found && accessTokenExpired {
		ds.logger.Debug("Access token expired, obtaining new one")
	}

	var refreshToken string
	var err error
	refreshTokenCached, found := ds.cache.Get("refreshToken")
	if !found {
		ds.logger.Debug("Loading refresh token from file")
		refreshToken, err = ds.cache.Load("refreshToken")
		if err != nil {
			ds.logger.Error(err.Error())
			return "", errors.New("Refresh token not found, authorize datasource first")
		}
		ds.logger.Debug("Refresh token loaded from file", "refresh token", refreshToken)
	} else {
		refreshToken = refreshTokenCached.(string)
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
func (ds *StravaDatasource) ExchangeToken(tsdbReq *datasource.DatasourceRequest, authCode string) (*TokenExchangeResponse, error) {
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
	ds.logger.Debug("Got new refresh token", "refresh token", refreshToken)

	ds.cache.Set("accessToken", accessToken, accessTokenExpIn)
	ds.cache.Set("refreshToken", refreshToken, cache.NoExpiration)
	ds.cache.Save("refreshToken", refreshToken)

	return &TokenExchangeResponse{
		AccessToken:      accessToken,
		AccessTokenExpAt: accessTokenExpAt,
		RefreshToken:     refreshToken,
	}, nil
}

// RefreshAccessToken refreshes expired Access token using refresh token
// https://developers.strava.com/docs/authentication/#refreshingexpiredaccesstokens
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

	ds.cache.Set("accessToken", accessToken, accessTokenExpIn)
	if refreshTokenNew != refreshToken {
		ds.logger.Debug("Got new refresh token", "refresh token", refreshTokenNew)
		ds.cache.Set("refreshToken", refreshTokenNew, cache.NoExpiration)
		ds.cache.Save("refreshToken", refreshTokenNew)
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

	query := tsdbReq.Queries[0]
	queryJSON, err := simplejson.NewJson([]byte(query.ModelJson))
	if err != nil {
		return nil, err
	}
	endpoint := queryJSON.Get("target").Get("endpoint").MustString()
	params := queryJSON.Get("target").Get("params").MustMap()

	requestUrlStr := fmt.Sprintf("%s/%s", StravaAPIUrl, endpoint)
	requestUrl, err := url.Parse(requestUrlStr)

	q := requestUrl.Query()
	for param, value := range params {
		q.Add(param, fmt.Sprint(value))
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
		return buildErrorResponse(err, &apiResponse), err
	}
	return buildResponse(apiResponse)
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
		p.logger.Debug("Datasource cache miss", "Org", dsInfo.GetOrgId(), "Id", dsInfo.GetId(), "Name", dsInfo.GetName(), "Hash", dsInfoHash)
	}

	ds, err := p.NewStravaDatasource(dsInfo)
	if err != nil {
		return nil, err
	}

	p.datasourceCache.SetDefault(dsInfoHash, ds)
	return ds, nil
}

// getQueryType determines the query type from a query or list of queries
func getQueryType(tsdbReq *datasource.DatasourceRequest) (string, error) {
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

// buildResponse transforms a Strava API response to a DatasourceResponse
func buildResponse(responseData []byte) (*datasource.DatasourceResponse, error) {
	return &datasource.DatasourceResponse{
		Results: []*datasource.QueryResult{
			&datasource.QueryResult{
				RefId:    "stravaAPI",
				MetaJson: string(responseData),
			},
		},
	}, nil
}

// buildErrorResponse creates a QueryResult that forwards an error to the front-end
func buildErrorResponse(err error, responseData *[]byte) *datasource.DatasourceResponse {
	metaJson := ""
	if responseData != nil {
		metaJson = string(*responseData)
	}
	return &datasource.DatasourceResponse{
		Results: []*datasource.QueryResult{
			&datasource.QueryResult{
				RefId:    "stravaAPI",
				Error:    err.Error(),
				MetaJson: metaJson,
			},
		},
	}
}
