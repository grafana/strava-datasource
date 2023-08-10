package main

import (
	"errors"
	"net/http"
	"os"
	"path"

	"github.com/grafana/strava-datasource/pkg/datasource"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
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
	dataDirPath, err := getDataDir()
	if err != nil {
		log.DefaultLogger.Error(err.Error())
	} else {
		log.DefaultLogger.Info("Data dir configured", "path", dataDirPath)
	}

	ds := datasource.NewStravaDatasource(dataDirPath)

	mux.HandleFunc("/", ds.RootHandler)
	mux.HandleFunc("/auth", ds.StravaAuthHandler)
	mux.HandleFunc("/strava-api", ds.StravaAPIHandler)
	mux.HandleFunc("/reset-access-token", ds.ResetAccessTokenHandler)
	mux.HandleFunc("/reset-cache", ds.ResetCacheHandler)

	return ds
}

func getDataDir() (string, error) {
	// Return GF_STRAVA_DS_DATA_PATH value if set
	dataDirPath, exist := os.LookupEnv(DATA_PATH_VARIABLE)
	if exist && dataDirPath != "" {
		log.DefaultLogger.Info("Environment variable for storage path found", "variable", DATA_PATH_VARIABLE, "value", dataDirPath)
		return dataDirPath, nil
	}
	log.DefaultLogger.Debug("Could not read environment variable", "variable", DATA_PATH_VARIABLE)

	dataDirOptions := make([]string, 0)

	userCacheDir, err := os.UserCacheDir()
	if err != nil {
		log.DefaultLogger.Debug("Cannot get OS cache directory path", "error", err)
	} else {
		dataDirOptions = append(dataDirOptions, userCacheDir)
	}

	dataDirOptions = append(dataDirOptions, "/var/lib/grafana/data", "/var/lib/grafana")

	for _, p := range dataDirOptions {
		dataDirPath, err := checkDataDir(p)
		if err == nil {
			return dataDirPath, nil
		} else {
			log.DefaultLogger.Debug("Error checking data directory", "error", err)
		}
	}

	return "", errors.New("Cannot get data directory")
}

func checkDataDir(p string) (string, error) {
	if _, err := os.Stat(p); err != nil {
		return "", err
	}
	dataDirPath := path.Join(p, DEFAULT_DATA_DIR)
	err := os.MkdirAll(dataDirPath, os.ModePerm)
	if err != nil {
		return "", err
	}
	return dataDirPath, nil
}
