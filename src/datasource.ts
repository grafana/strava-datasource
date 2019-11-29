import moment from "moment";
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
    const { range } = options;
    const from = range.from.valueOf();
    const to = range.to.valueOf();

    const data = options.targets.map(target => {
      this.stravaApi.getActivities().then(response => {
        return new MutableDataFrame({
          refId: target.refId,
          fields: [
            { name: "Time", values: [from, to], type: FieldType.time },
            {
              name: "Value",
              values: [response.elapsed_time, response.elapsed_time],
              type: FieldType.number
            }
          ]
        });
      });
    });

    return { data };
  }

  convertToTimeSeries(data: any): TimeSeries {
    return {
      target: "activities",
      datapoints: data.map(entry => {
        return [entry.elapsed_time, moment(entry.start_date).valueOf()];
      })
    };
  }

  testDatasource() {
    return this.request("athlete/activities")
      .then(response => {
        console.log(response);
        return { status: "success", message: "Data source is working" };
      })
      .catch(error => {
        console.log(error);
        return { status: "error", message: "Cannot connect to Strava API" };
      });
  }

  transformActivitiesToTimeseries(data: any[], target: StravaQuery) {
    const datapoints = [];
    for (const activity of data) {
      datapoints.push([
        activity[target.activityStat],
        dateTime(activity.start_date).valueOf(),
      ]);
    }
    datapoints.sort((dpA, dpB) => dpA[1] - dpB[1]);
    return {
      series: target.activityStat,
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

  async request(url: string, options?: any) {
    try {
      const { data } = await this.backendSrv.datasourceRequest({
        url: `${this.apiUrl}/strava/${url}`,
        // url: `${this.apiUrl}/api/${url}`,
        method: "GET"
      });
      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
