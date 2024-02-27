# Change Log

## [1.7.0] - 2024-02-27

### Changed

- Plugin uses service account to store and update refresh token in data source secure JSON data. Required Grafana 10.3 and `externalServiceAccounts` feature toggle to be enabled. Fixes re-authentication in Grafana Cloud.
- "Refresh token" authentication type removed and not supported anymore.

## [1.6.1] - 2022-08-10

### Fixed

- Invalid plugin signature after grafana restart

## [1.6.0] - 2023-08-08

### Added

- Authentication: Forward OAuth identity
- Add more data to geomap format
- Add Walk as a separate activity
- Display pace values in reverse order

## [1.5.1] - 2022-09-08

### Fixed

- 401 Unauthorized when connecting to Strava API, [#62](https://github.com/grafana/strava-datasource/issues/62)

## [1.5.0] - 2022-08-24

### Added

- Weighted average power metric, [#50](https://github.com/grafana/strava-datasource/issues/50)
- Improved caching (including data pre-fetching).
- Special _Pace_ stat which formats time based on activity type.
- Query segments data.
- Updated dashboards with data links navigation.
- Achievements stats.
- Activity route supports shared crosshair.
- More precise data streams handling.
- Build for Mac M1.

## [1.4.1] - 2021-12-27

### Fixed

- Dashboard data sources (fix broken dashboards)

## [1.4.0] - 2021-12-27

### Added

- Display activity route on the Geomap panel, [#49](https://github.com/grafana/strava-datasource/issues/49).
- Heatmap format which allows to visualize activities over selected time range as a heatmap on Geomap panel.
- Authentication by refresh token from the app config page.
- Automatically convert units based on user's preferences, [#43](https://github.com/grafana/strava-datasource/issues/43).
- Updates for the dashboards.

## [1.3.0] - 2021-05-13

### Added

- Individual activity query. Now it's possible to visualize activity-specific metrics: heart rate graph, speed/pace, splits and many other metrics.
- Template variables support (fetch list of activities and use activity it as a variable).

## [1.2.0] - 2020-10-14

### Added

- ARM build

### Fixed

- Fix compatibility with Grafana 7.x
- Sign plugin
- Fix dashboards

## [1.1.1] - 2020-03-05

### Fixed

- Don't use git LFS for plugin binaries

## [1.1.0] - 2020-03-05

### Added

- Authentication on the backend, [#2](https://github.com/grafana/strava-datasource/issues/2)

## [1.0.1] - 2020-01-10

### Fixed

- Error handling while testing data source
- Configuration docs link

## [1.0.0] - 2020-01-09

### Added

- Initial time series data support
- Initial Worldmap panel format support
- Activity type selection
- Aggregation intervals
