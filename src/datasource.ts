import {
  DataQueryRequest,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  MutableDataFrame,
  TimeSeries,
  TableData,
  dateTime,
  TimeRange,
} from "@grafana/data";
import StravaApi from "./stravaApi";
import polyline from './polyline';
import {
  StravaActivityStat,
  StravaJsonData,
  StravaQuery,
  StravaQueryType,
  StravaQueryFormat,
  StravaActivityType
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
    const data = [];
    console.log(options);

    const activities = await this.stravaApi.getActivities({
      before: options.range.to.unix(),
      after: options.range.from.unix(),
    });

    for (const target of options.targets) {
      const filteredActivities = this.filterActivities(activities, target.activityType);
      switch (target.format) {
        case StravaQueryFormat.Table:
          const tableData = this.transformActivitiesToTable(filteredActivities, target);
          data.push(tableData);
          break;
        case StravaQueryFormat.WorldMap:
          const wmData = this.transformActivitiesToWorldMap(filteredActivities, target);
          data.push(wmData);
          break;
        default:
          const tsData = this.transformActivitiesToTimeseries(filteredActivities, target, options.range);
          data.push(tsData);
          break;
      }
    }

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

  filterActivities(activities: any[], activityType: StravaActivityType): any[] {
    if (!activityType) {
      // No filter, return all
      return activities;
    }

    return activities.filter(activitiy => {
      if (activityType === 'Other') {
        return activitiy.type !== 'Run' && activitiy.type !== 'Ride';
      } else {}
      return activitiy.type === activityType;
    });
  }

  transformActivitiesToTimeseries(data: any[], target: StravaQuery, range: TimeRange): TimeSeries {
    let datapoints = [];
    for (const activity of data) {
      datapoints.push([
        activity[target.activityStat],
        dateTime(activity.start_date).valueOf(),
      ]);
    }
    datapoints.sort((dpA, dpB) => dpA[1] - dpB[1]);
    const aggInterval = getAggregationInterval(range);
    datapoints = groupBySum(datapoints, aggInterval);
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
      const middlePoint = getActivityMiddlePoint(activity);
      const latitude = middlePoint ? middlePoint[0] : activity.start_latitude;
      const longitude = middlePoint ? middlePoint[1] : activity.start_longitude;
      const row = [
        activity[target.activityStat],
        activity.name,
        latitude,
        longitude,
      ];
      if (activity.start_latitude && activity.start_longitude) {
        table.rows.push(row);
      }
    }
    return table;
  }
}

function getActivityMiddlePoint(activity: any): number[] {
  if (!activity.map || !activity.map.summary_polyline) {
    return null;
  }

  const summaryPolyline = activity.map.summary_polyline;
  const points = polyline.decode(summaryPolyline);
  if (points && points.length) {
    const middleIndex = Math.floor(points.length / 2);
    return points[middleIndex];
  } else {
    return null;
  }
}

function getAggregationInterval(range: TimeRange): number {
  const interval = range.to.unix() - range.from.unix();
  const interval_ms = interval * 1000;
  switch (true) {
    // 4d
    case interval_ms <= 345600000:
      return 3600000; // 1h
    // 90d
    case interval_ms <= 7776000000:
      return 86400000; // 1d
    // 1y
    case interval_ms <= 31536000000:
      return 604800000; // 1w
    default:
      return 604800000; // 1w
  }
}

const POINT_VALUE = 0;
const POINT_TIMESTAMP = 1;

export function groupBySum(datapoints: any[], interval: number): any[] {
  if (datapoints.length === 0) {
    return [];
  }

  let grouped_series = [];
  let frame_values = [];
  let frame_value;
  let frame_ts = datapoints.length ? getPointTimeFrame(datapoints[0][POINT_TIMESTAMP], interval) : 0;
  let point_frame_ts = frame_ts;
  let point;
  const sum = (acc, val) => acc + val;

  for (let i = 0; i < datapoints.length; i++) {
    point = datapoints[i];
    point_frame_ts = getPointTimeFrame(point[POINT_TIMESTAMP], interval);
    if (point_frame_ts === frame_ts) {
      frame_values.push(point[POINT_VALUE]);
    } else if (point_frame_ts > frame_ts) {
      frame_value = frame_values.reduce(sum);
      grouped_series.push([frame_value, frame_ts]);

      // Move frame window to next non-empty interval and fill empty by null
      frame_ts += interval;
      while (frame_ts < point_frame_ts) {
        grouped_series.push([null, frame_ts]);
        frame_ts += interval;
      }
      frame_values = [point[POINT_VALUE]];
    }
  }

  frame_value = frame_values.reduce(sum);
  grouped_series.push([frame_value, frame_ts]);

  return grouped_series;
}

function getPointTimeFrame(timestamp, ms_interval) {
  return Math.floor(timestamp / ms_interval) * ms_interval;
}
