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

Once data source is configured, you can import pre-configured dashboards from _Dashboards_ tab at the data source configuration page. That's a good starting point for your own custom dashboards.

Unfortunately, Strava API has some limitations and you can query only your own activities. But for multi-user dashboards you can configure multiple data sources and authorize separate user for each of them.

Some included dashboards depend on Grafana's new version of the panels or features which can be in alpha state in Grafana. If you want to [enable alpha panels](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#enable_alpha) and avoid seeing an error message in the dashboard, set `GF_PANELS_ENABLE_ALPHA` environment variable to true. Example:

```sh
export GF_PLUGINS_ENABLE_ALPHA=true
```

or add config options to `grafana.ini`:

```ini
[panels]
enable_alpha = true
```
