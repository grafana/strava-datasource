# Strava datasource for Grafana dashboard

Visualize your sport activity with Grafana.

![Strava Dashboard](https://user-images.githubusercontent.com/4932851/72068746-d54a9580-32f6-11ea-9352-c2bcaa2a723a.png)

Features:

- Query activities stats and present it as a time series data.
- Table format.
- Show activities over the world with [Geomap Panel](https://grafana.com/docs/grafana/latest/visualizations/geomap/).
- Visualize and analyze activity data such as heart rate, speed/pace, power, etc.
- Template variables support.

## Configuration

See [configuration](https://github.com/grafana/strava-datasource/blob/master/docs/configuration.md) docs.

## Quick start

Before you start grafana server, configure plugin data directory with `GF_STRAVA_DS_DATA_PATH` environment variable. This required for storing obtained refresh tokens and make it available after plugin restart. Default path is plugin directory, but it will be removed during plugin upgrade, so for persistent storage it's better to use grafana data directory. Example:

```sh
mkdir /var/lib/grafana/strava
export GF_STRAVA_DS_DATA_PATH=/var/lib/grafana/strava
```

When data source is configured, you can import example dashboards from _Dashboards_ tab at the data source configuration page. That's a good starting point for your custom dashboards.

Unfortunately, Strava API has some limitations and you can query only your own activities. But for multi-user dashboards you can configure multiple data sources and authorize separate user for each of them.

Included dashboard "Strava Athlete Dashboad" depends on Grafana's new version of the text panel plugin which can be in alpha state in older Grafana versions. If you want to enable alpha plugins and avoid seeing an error message in the dashboard, set `GF_PLUGINS_ENABLE_ALPHA` environment variable to true. Example:

```sh
export GF_PLUGINS_ENABLE_ALPHA=true
```
