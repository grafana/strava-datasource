package datasource

import (
	"encoding/json"
	"io/ioutil"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

// Resource handler describes handlers for the resources populated by plugin in plugin.go, like:
// mux.HandleFunc("/", ds.RootHandler)
// mux.HandleFunc("/strava-api", ds.StravaAPIHandler)

func (ds *StravaDatasource) RootHandler(rw http.ResponseWriter, req *http.Request) {
	ds.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

	rw.Write([]byte("Hello from Strava data source!"))
	rw.WriteHeader(http.StatusOK)
}

func (ds *StravaDatasource) StravaAuthHandler(rw http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		return
	}

	body, err := ioutil.ReadAll(req.Body)
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

	pluginCxt := httpadapter.PluginConfigFromContext(req.Context())
	dsInstance, err := ds.getDSInstance(pluginCxt)
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

func (ds *StravaDatasource) ResetAccessTokenHandler(rw http.ResponseWriter, req *http.Request) {
	pluginCxt := httpadapter.PluginConfigFromContext(req.Context())
	dsInstance, err := ds.getDSInstance(pluginCxt)
	if err != nil {
		ds.logger.Error("Error loading datasource", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	err = dsInstance.ResetAccessToken()
	if err != nil {
		ds.logger.Error("Error reseting access token", "error", err)
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
	rw.Write(b)
}

func (ds *StravaDatasource) StravaAPIHandler(rw http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		return
	}

	body, err := ioutil.ReadAll(req.Body)
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

	pluginCxt := httpadapter.PluginConfigFromContext(req.Context())
	dsInstance, err := ds.getDSInstance(pluginCxt)
	if err != nil {
		ds.logger.Error("Error loading datasource", "error", err)
		writeError(rw, http.StatusInternalServerError, err)
		return
	}

	result, err := dsInstance.StravaAPIQuery(req.Context(), &apiReq)
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
	rw.Write(resultJson)
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
	rw.Write(b)
}
