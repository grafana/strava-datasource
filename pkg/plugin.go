package main

import (
	"time"

	"github.com/grafana/grafana-plugin-model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	plugin "github.com/hashicorp/go-plugin"
)

var pluginLogger = hclog.New(&hclog.LoggerOptions{
	Name:  "strava-datasource",
	Level: hclog.LevelFromString("DEBUG"),
})

func main() {
	pluginLogger.Debug("Running Strava backend datasource")

	plugin.Serve(&plugin.ServeConfig{

		HandshakeConfig: plugin.HandshakeConfig{
			ProtocolVersion:  1,
			MagicCookieKey:   "grafana_plugin_type",
			MagicCookieValue: "datasource",
		},
		Plugins: map[string]plugin.Plugin{
			"strava-backend-datasource": &datasource.DatasourcePluginImpl{Plugin: &StravaPlugin{
				datasourceCache: NewCache(10*time.Minute, 10*time.Minute),
				logger:          pluginLogger,
			}},
		},

		// A non-nil value here enables gRPC serving for this plugin...
		GRPCServer: plugin.DefaultGRPCServer,
	})
}
