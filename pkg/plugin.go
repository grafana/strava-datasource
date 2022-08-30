package main

import (
	"net/http"
	"os"
	"path"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/strava-datasource/pkg/datasource"
)

const (
	STRAVA_PLUGIN_ID   = "strava-backend-datasource"
	DATA_PATH_VARIABLE = "GF_STRAVA_DS_DATA_PATH"
	DEFAULT_DATA_DIR   = "strava-datasource"
)

func main() {
	backend.SetupPluginEnvironment(STRAVA_PLUGIN_ID)
	mux := http.NewServeMux()
	ds := Init(mux)
	httpResourceHandler := httpadapter.New(mux)

	log.DefaultLogger.Debug("Starting Strava datasource")

	err := backend.Serve(backend.ServeOpts{
		CallResourceHandler: httpResourceHandler,
		QueryDataHandler:    ds,
		CheckHealthHandler:  ds,
	})
	if err != nil {
		log.DefaultLogger.Error("Error starting Strava datasource", "error", err.Error())
	}
}

func Init(mux *http.ServeMux) *datasource.StravaDatasource {
	dataDirPath, exist := os.LookupEnv(DATA_PATH_VARIABLE)
	if exist && dataDirPath != "" {
		log.DefaultLogger.Debug("Environment variable for storage path found", "variable", DATA_PATH_VARIABLE, "value", dataDirPath)
	} else {
		log.DefaultLogger.Info("Could not read environment variable", "variable", DATA_PATH_VARIABLE)
		var err error
		dataDirPath, err = os.UserCacheDir()
		if err != nil {
			log.DefaultLogger.Error("Cannot get OS cache directory path", "error", err)
		}
		dataDirPath = path.Join(dataDirPath, DEFAULT_DATA_DIR)
		err = os.MkdirAll(dataDirPath, os.ModePerm)
		if err != nil {
			log.DefaultLogger.Error("Cannot create data directory", "error", err)
		}
		log.DefaultLogger.Info("Using default data path", "path", dataDirPath)
	}

	ds := datasource.NewStravaDatasource(dataDirPath)

	mux.HandleFunc("/", ds.RootHandler)
	mux.HandleFunc("/auth", ds.StravaAuthHandler)
	mux.HandleFunc("/strava-api", ds.StravaAPIHandler)
	mux.HandleFunc("/reset-access-token", ds.ResetAccessTokenHandler)

	return ds
}
