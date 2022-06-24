package datasource

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type StravaAPIRequest struct {
	Endpoint string                     `json:"endpoint"`
	Params   map[string]json.RawMessage `json:"params,omitempty"`
}

type StravaApiResourceResponse struct {
	Result interface{} `json:"result,omitempty"`
}

type StravaAuthRequest struct {
	AuthCode string `json:"authCode"`
}

type StravaAuthResourceResponse struct {
	Result interface{} `json:"result,omitempty"`
}

type TokenExchangeResponse struct {
	AccessToken      string `json:"access_token"`
	AccessTokenExpAt int64  `json:"expires_at"`
	RefreshToken     string `json:"refresh_token"`
}

// QueryModel model
type QueryModel struct {
	QueryType    string `json:"queryType"`
	ActivityStat string `json:"activityStat"`
	ActivityType string `json:"activityType"`
	Format       string `json:"format"`
	Interval     string `json:"interval"`

	// Direct from the gRPC interfaces
	TimeRange backend.TimeRange `json:"-"`
}

// ReadQuery will read and validate Settings from the DataSourceConfg
func ReadQuery(query backend.DataQuery) (QueryModel, error) {
	model := QueryModel{}
	if err := json.Unmarshal(query.JSON, &model); err != nil {
		return model, fmt.Errorf("could not read query: %w", err)
	}

	model.TimeRange = query.TimeRange
	return model, nil
}

type StravaDatasourceSettingsDTO struct {
	StravaAuthType string `json:"stravaAuthType"`
	ClientID       string `json:"clientID"`
	CacheTTL       string `json:"cacheTTL"`
}

type ActivityDTO = struct {
	Id int64 `json:"id"`
}
