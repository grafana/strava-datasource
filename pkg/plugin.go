package main

import (
	"net/http"
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/strava-datasource/pkg/datasource"
)

const (
	STRAVA_PLUGIN_ID   = "strava-backend-datasource"
	DATA_PATH_VARIABLE = "GF_STRAVA_DS_DATA_PATH"
)

func main() {
	backend.SetupPluginEnvironment(STRAVA_PLUGIN_ID)

	pluginLogger := log.New()
	mux := http.NewServeMux()
	ds := Init(pluginLogger, mux)
	httpResourceHandler := httpadapter.New(mux)

	pluginLogger.Debug("Starting Strava datasource")

	err := backend.Serve(backend.ServeOpts{
		CallResourceHandler: httpResourceHandler,
		QueryDataHandler:    ds,
		CheckHealthHandler:  ds,
	})
	if err != nil {
		pluginLogger.Error("Error starting Zabbix datasource", "error", err.Error())
	}
}

func Init(logger log.Logger, mux *http.ServeMux) *datasource.StravaDatasource {
	path, exist := os.LookupEnv(DATA_PATH_VARIABLE)
	if !exist {
		logger.Debug("Could not read environment variable", DATA_PATH_VARIABLE)
	} else {
		logger.Debug("Environment variable for storage path found", "variable", DATA_PATH_VARIABLE, "value", path)
	}

	ds := datasource.NewStravaDatasource(path)

	mux.HandleFunc("/", ds.RootHandler)
	mux.HandleFunc("/auth", ds.StravaAuthHandler)
	mux.HandleFunc("/strava-api", ds.StravaAPIHandler)

	return ds
}
