package datasource

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	simplejson "github.com/bitly/go-simplejson"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// Resource handler describes handlers for the resources populated by plugin in plugin.go, like:
// mux.HandleFunc("/", ds.RootHandler)
// mux.HandleFunc("/strava-api", ds.StravaAPIHandler)

func (ds *StravaDatasourcePlugin) RootHandler(rw http.ResponseWriter, req *http.Request) {
	ds.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

	_, err := rw.Write([]byte("Hello from Strava data source!"))
	if err != nil {
		ds.logger.Warn("Error writing response")
	}
	rw.WriteHeader(http.StatusOK)
}

func (ds *StravaDatasourcePlugin) StravaAuthHandler(rw http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		return
	}

	body, err := io.ReadAll(req.Body)
	defer req.Body.Close()
	if err != nil || len(body) == 0 {
		writeError(rw, http.StatusBadRequest, err)
		return
	}

	var reqData StravaAuthRequest
	err = json.Unmarshal(body, &reqData)
	if err != nil {
		ds.logger.Error("Cannot unmarshal request", "error", err.Error())
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	pluginCxt := backend.PluginConfigFromContext(req.Context())
	dsInstance, err := ds.getDSInstance(req.Context(), pluginCxt)
	if err != nil {
		ds.logger.Error("Error loading datasource", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	result, err := dsInstance.StravaAuthQuery(req.Context(), &reqData)
	if err != nil {
		ds.logger.Error("Strava API request error", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	writeAuthResponse(rw, result)
}

func (ds *StravaDatasourcePlugin) ResetAccessTokenHandler(rw http.ResponseWriter, req *http.Request) {
	pluginCxt := backend.PluginConfigFromContext(req.Context())
	dsInstance, err := ds.getDSInstance(req.Context(), pluginCxt)
	if err != nil {
		ds.logger.Error("Error loading datasource", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	err = dsInstance.ResetAccessToken()
	if err != nil {
		ds.logger.Error("Error resetting access token", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	data := make(map[string]interface{})
	data["message"] = "Access token removed"
	var b []byte
	if b, err = json.Marshal(data); err != nil {
		rw.WriteHeader(http.StatusOK)
		return
	}

	rw.Header().Add("Content-Type", "application/json")
	rw.WriteHeader(http.StatusOK)
	_, err = rw.Write(b)
	if err != nil {
		ds.logger.Warn("Error writing response")
	}
}

func (ds *StravaDatasourcePlugin) ResetCacheHandler(rw http.ResponseWriter, req *http.Request) {
	pluginCxt := backend.PluginConfigFromContext(req.Context())
	dsInstance, err := ds.getDSInstance(req.Context(), pluginCxt)
	if err != nil {
		ds.logger.Error("Error loading datasource", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	dsInstance.ResetCache()

	data := make(map[string]interface{})
	data["message"] = "Cache flushed"
	var b []byte
	if b, err = json.Marshal(data); err != nil {
		rw.WriteHeader(http.StatusOK)
		return
	}

	rw.Header().Add("Content-Type", "application/json")
	rw.WriteHeader(http.StatusOK)
	_, err = rw.Write(b)
	if err != nil {
		ds.logger.Warn("Error writing response")
	}
}

func (ds *StravaDatasourcePlugin) StravaAPIHandler(rw http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		return
	}

	body, err := io.ReadAll(req.Body)
	defer req.Body.Close()
	if err != nil || len(body) == 0 {
		writeError(rw, http.StatusBadRequest, err)
		return
	}

	var apiReq StravaAPIRequest
	err = json.Unmarshal(body, &apiReq)
	if err != nil {
		ds.logger.Error("Cannot unmarshal request", "error", err.Error())
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	pluginCxt := backend.PluginConfigFromContext(req.Context())
	dsInstance, err := ds.getDSInstance(req.Context(), pluginCxt)
	if err != nil {
		ds.logger.Error("Error loading datasource", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	oauthPassThru := isOAuthPassThruEnabled(dsInstance)
	if oauthPassThru {
		accessToken := ""
		if len(req.Header["Authorization"]) > 0 {
			authorizationStr := req.Header["Authorization"][0]
			values := strings.Split(authorizationStr, " ")
			if len(values) > 1 {
				accessToken = values[1]
			}
		}
		apiReq.AccessToken = accessToken
	}

	requestHash := HashByte(body)
	stravaApiQueryFn := dsInstance.StravaAPIQueryWithCache(requestHash)
	result, err := stravaApiQueryFn(req.Context(), &apiReq)
	if err != nil {
		ds.logger.Error("Strava API request error", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	writeApiResponse(rw, result)
}

func writeApiResponse(rw http.ResponseWriter, result *StravaApiResourceResponse) {
	resultJson, err := json.Marshal(*result)
	if err != nil {
		writeError(rw, http.StatusInternalServerError, err)
	}

	writeResponse(rw, resultJson)
}

func writeAuthResponse(rw http.ResponseWriter, result *StravaAuthResourceResponse) {
	resultJson, err := json.Marshal(*result)
	if err != nil {
		writeError(rw, http.StatusInternalServerError, err)
	}

	writeResponse(rw, resultJson)
}

func writeResponse(rw http.ResponseWriter, resultJson []byte) {
	rw.Header().Add("Content-Type", "application/json")
	rw.WriteHeader(http.StatusOK)
	_, err := rw.Write(resultJson)
	if err != nil {
		log.DefaultLogger.Warn("Error writing response")
	}
}

func writeError(rw http.ResponseWriter, statusCode int, err error) {
	data := make(map[string]interface{})

	data["error"] = "Internal Server Error"
	data["message"] = err.Error()

	var b []byte
	if b, err = json.Marshal(data); err != nil {
		rw.WriteHeader(statusCode)
		return
	}

	rw.Header().Add("Content-Type", "application/json")
	rw.WriteHeader(http.StatusInternalServerError)
	_, err = rw.Write(b)
	if err != nil {
		log.DefaultLogger.Warn("Error writing response")
	}
}

func isOAuthPassThruEnabled(dsInstance *StravaDatasourceInstance) bool {
	jsonDataStr := dsInstance.dsInfo.JSONData
	jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
	if err != nil {
		return false
	}
	return jsonData.Get("oauthPassThru").MustBool()
}
