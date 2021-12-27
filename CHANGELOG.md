# Change Log

## [1.4.0] - 2021-12-27

### Added

- Display activity route on the Geomap panel, [#49](https://github.com/grafana/strava-datasource/issues/49).
- Heatmap format which allows to visualize activities over selected time range as a heatmap on Geomap panel.
- Athentication by refresh token from the app config page.
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
