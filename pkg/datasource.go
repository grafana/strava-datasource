package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"time"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	plugin "github.com/hashicorp/go-plugin"
)

// StravaPlugin implements the Grafana backend interface and forwards queries to the StravaDatasource
type StravaPlugin struct {
	plugin.NetRPCUnsupportedPlugin
	logger          hclog.Logger
	datasourceCache *Cache
}

// ZabbixDatasource stores state about a specific datasource and provides methods to make
// requests to the Zabbix API
type StravaDatasource struct {
	url        *url.URL
	authToken  string
	dsInfo     *datasource.DatasourceInfo
	queryCache *Cache
	logger     hclog.Logger
	httpClient *http.Client
}

// newZabbixDatasource returns an initialized ZabbixDatasource
func newStravaDatasource(dsInfo *datasource.DatasourceInfo) (*StravaDatasource, error) {
	zabbixURLStr := dsInfo.GetUrl()
	zabbixURL, err := url.Parse(zabbixURLStr)
	if err != nil {
		return nil, err
	}

	return &StravaDatasource{
		url:        zabbixURL,
		dsInfo:     dsInfo,
		queryCache: NewCache(10*time.Minute, 10*time.Minute),
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
	ds, err := newStravaDatasource(dsInfo)
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
	case "StravaAPI":
		resp, err = StravaDS.StravaAPIQuery(ctx, tsdbReq)
	default:
		err = errors.New("Query not implemented")
		return BuildErrorResponse(err), nil
	}

	return
}

func (ds *StravaDatasource) StravaAPIQuery(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	response := &datasource.DatasourceResponse{
		Results: []*datasource.QueryResult{
			&datasource.QueryResult{
				RefId:    "stravaAPI",
				MetaJson: "",
			},
		},
	}
	return response, nil
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

	p.datasourceCache.Set(dsInfoHash, ds)
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
