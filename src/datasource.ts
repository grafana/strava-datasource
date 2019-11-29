import {
  DataQueryRequest,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  MutableDataFrame,
  TimeSeries,
  TableData,
  dateTime,
} from "@grafana/data";
import StravaApi from "./stravaApi";

import {
  StravaActivityStat,
  StravaJsonData,
  StravaQuery,
  StravaQueryType,
  StravaQueryFormat
} from "./types";

export default class StravaDatasource extends DataSourceApi<StravaQuery, StravaJsonData> {
  type: any;
  apiUrl: string;
  datasourceName: string;
  stravaApi: StravaApi;

  /** @ngInject */
  constructor(
    instanceSettings: DataSourceInstanceSettings<StravaJsonData>,
    private backendSrv: any,
    private templateSrv: any,
    private timeSrv: any
  ) {
    super(instanceSettings);
    this.type = "strava";
    this.apiUrl = instanceSettings.url;
    this.stravaApi = new StravaApi(instanceSettings.url, backendSrv);
  }

  async query(options: DataQueryRequest<StravaQuery>) {
    console.log(options);
    const data = [];

    const activities = await this.stravaApi.getActivities({
      before: options.range.to.unix(),
      after: options.range.from.unix(),
    });

    for (const target of options.targets) {
      switch (target.format) {
        case StravaQueryFormat.Table:
          const tableData = this.transformActivitiesToTable(activities, options.targets[0]);
          data.push(tableData);
          break;
        case StravaQueryFormat.WorldMap:
          const wmData = this.transformActivitiesToWorldMap(activities, options.targets[0]);
          data.push(wmData);
          break;
        default:
          const tsData = this.transformActivitiesToTimeseries(activities, options.targets[0]);
          data.push(tsData);
          break;
      }
    }

    console.log(data);
    return { data };
  }

  testDatasource() {
    return this.stravaApi.getActivities({ per_page: 2, limit: 2})
      .then(response => {
        console.log(response);
        return { status: "success", message: "Data source is working" };
      })
      .catch(error => {
        console.log(error);
        return { status: "error", message: "Cannot connect to Strava API" };
      });
  }

  transformActivitiesToTimeseries(data: any[], target: StravaQuery): TimeSeries {
    const datapoints = [];
    for (const activity of data) {
      datapoints.push([
        activity[target.activityStat],
        dateTime(activity.start_date).valueOf(),
      ]);
    }
    datapoints.sort((dpA, dpB) => dpA[1] - dpB[1]);
    return {
      target: target.activityStat,
      datapoints
    };
  }

  transformActivitiesToTable(data: any[], target: StravaQuery) {
    const table: TableData = {
      type: 'table',
      columns: [
        { text: 'Time'},
        { text: 'name' },
        { text: 'distance', unit: 'lengthm' },
        { text: 'moving_time', unit: 's' },
        { text: 'elapsed_time', unit: 's' },
        { text: 'total_elevation_gain', unit: 'lengthm' },
        { text: 'type' },
        { text: 'kilojoules', unit: 'joule' },
      ],
      rows: []
    };

    for (const activity of data) {
      const row = [
        dateTime(activity.start_date),
        activity.name,
        activity.distance,
        activity.moving_time,
        activity.elapsed_time,
        activity.total_elevation_gain,
        activity.type,
        activity.kilojoules,
      ];
      if (activity.start_latitude && activity.start_longitude) {
        table.rows.push(row);
      }
    }
    return table;
  }

  transformActivitiesToWorldMap(data: any[], target: StravaQuery) {
    const unit =
      target.activityStat === StravaActivityStat.Distance ||
      target.activityStat === StravaActivityStat.ElevationGain ? 'lengthm' : 's';
    const table: TableData = {
      type: 'table',
      columns: [
        { text: 'value', unit },
        { text: 'name' },
        { text: 'latitude' },
        { text: 'longitude' },
      ],
      rows: []
    };

    for (const activity of data) {
      const row = [
        activity[target.activityStat],
        activity.name,
        activity.start_latitude,
        activity.start_longitude,
      ];
      if (activity.start_latitude && activity.start_longitude) {
        table.rows.push(row);
      }
    }
    return table;
  }
}
