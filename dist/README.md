# Strava datasource for Grafana dashboard

Visualize your sport activity with Grafana.

![Strava Dashboard](https://user-images.githubusercontent.com/4932851/72068746-d54a9580-32f6-11ea-9352-c2bcaa2a723a.png)

Features:

- Query activities stats and present it as a time series data.
- Table format
- Show activities over the world with [Worldmap Panel](https://grafana.com/grafana/plugins/grafana-worldmap-panel)

### Configuration

See [configuration](https://github.com/grafana/strava-datasource/blob/master/docs/configuration.md) docs.

### Quick start

When data source is configured, you can import example dashboards from _Dashboards_ tab at the data source configuration page. That's a good starting point for your custom dashboards.

Unfortunately, Strava API has some limitations and you can query only your own activities. But for multi-user dashboards you can configure multiple data sources and authorize separate user for each of them.

### Known issues

After some time after authorization you may see an error while refreshing dashboard. Check grafana logs and if you see `status=401` message, try to re-connect data source to Strava. Click _Connect with Strava_ button, grant access and then click _Reset_ button at the right of _Auth Code_ input. Then click _Fill_ to copy new auth code from page URL and save data source configuration.
