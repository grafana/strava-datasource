import {
  DataQueryRequest,
  DataSourceApi,
  DataSourceInstanceSettings,
  TimeSeries,
  TableData,
  dateTime,
  TimeRange,
  TimeSeriesPoints,
  TimeSeriesValue,
  TIME_SERIES_TIME_FIELD_NAME,
  FieldType,
  MutableField,
  ArrayVector,
  MutableDataFrame,
  TIME_SERIES_VALUE_FIELD_NAME,
  MetricFindValue,
} from '@grafana/data';
import StravaApi from './stravaApi';
import polyline from './polyline';
import {
  StravaActivityStat,
  StravaJsonData,
  StravaQuery,
  StravaQueryFormat,
  StravaActivityType,
  StravaQueryInterval,
  StravaQueryType,
  StravaActivityStream,
  StravaActivityData,
  StravaSplitStat,
  VariableQuery,
} from './types';
import { smoothVelocityData, velocityDataToPace, velocityDataToSpeed, velocityToSpeed } from 'utils';
import { getTemplateSrv } from '@grafana/runtime';

const DEFAULT_RANGE = {
  from: dateTime(),
  to: dateTime(),
  raw: {
    from: 'now',
    to: 'now',
  },
};

export default class StravaDatasource extends DataSourceApi<StravaQuery, StravaJsonData> {
  type: any;
  datasourceId: number;
  apiUrl: string;
  stravaApi: StravaApi;
  activities: any[];

  /** @ngInject */
  constructor(instanceSettings: DataSourceInstanceSettings<StravaJsonData>) {
    super(instanceSettings);
    this.type = 'strava';
    this.datasourceId = instanceSettings.id;
    this.apiUrl = instanceSettings.url!;
    this.stravaApi = new StravaApi(this.datasourceId);
    this.activities = [];
  }

  async query(options: DataQueryRequest<StravaQuery>) {
    const data: any[] = [];
    let activities = [];

    let queryActivities = options.targets.some((t) => t.queryType === StravaQueryType.Activities);

    if (queryActivities) {
      activities = await this.stravaApi.getActivities({
        before: options.range?.to.unix(),
        after: options.range?.from.unix(),
      });
    }

    for (const target of options.targets) {
      if (target.hide) {
        continue;
      }

      if (target.queryType === StravaQueryType.Activities) {
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
            const tsData = this.transformActivitiesToTimeseries(
              filteredActivities,
              target,
              options.range || DEFAULT_RANGE
            );
            data.push(tsData);
            break;
        }
      } else if (target.queryType === StravaQueryType.Activity) {
        const activityData = await this.queryActivity(options, target);
        data.push(activityData);
      }
    }

    return { data };
  }

  async queryActivity(options: DataQueryRequest<StravaQuery>, target: StravaQuery) {
    const activityId = getTemplateSrv().replace(target.activityId?.toString());
    const activity = await this.stravaApi.getActivity({
      id: activityId,
      include_all_efforts: true,
    });

    let activityStream = target.activityGraph;
    if (activityStream === StravaActivityStream.Pace) {
      activityStream = StravaActivityStream.Velocity;
    }

    if (!activityStream) {
      return null;
    }

    if (target.activityData === StravaActivityData.Splits) {
      return this.queryActivitySplits(options, target, activity);
    }

    const streams = await this.stravaApi.getActivityStreams({
      id: activityId,
      streamType: activityStream,
    });

    const timeFiled: MutableField<number> = {
      name: TIME_SERIES_TIME_FIELD_NAME,
      type: FieldType.time,
      config: {
        custom: {},
      },
      values: new ArrayVector(),
    };

    const valueFiled: MutableField<number> = {
      name: activityStream,
      type: FieldType.number,
      config: {
        custom: {},
      },
      values: new ArrayVector(),
    };

    const frame = new MutableDataFrame({
      name: activity.name,
      refId: target.refId,
      fields: [],
    });

    const stream = streams[activityStream];
    if (!stream) {
      return frame;
    }

    let ts = dateTime(activity.start_date).unix();
    if (target.fitToTimeRange) {
      ts = options.range.from.unix();
    }

    let streamValues: number[] = [];
    for (let i = 0; i < stream.data.length; i++) {
      timeFiled.values.add(ts * 1000);
      streamValues.push(stream.data[i]);
      ts++;
    }

    if (activity.type === 'Run') {
      if (target.activityGraph === StravaActivityStream.Pace) {
        valueFiled.name = 'pace';
        streamValues = velocityDataToPace(streamValues);
      }
    } else {
      if (target.activityGraph === StravaActivityStream.Velocity) {
        valueFiled.name = 'speed';
        streamValues = velocityDataToSpeed(streamValues);
      }
    }

    // Smooth data
    if (
      activityStream === StravaActivityStream.Velocity ||
      activityStream === StravaActivityStream.HeartRate ||
      activityStream === StravaActivityStream.GradeSmooth ||
      activityStream === StravaActivityStream.WattsCalc ||
      activityStream === StravaActivityStream.Watts
    ) {
      streamValues = smoothVelocityData(streamValues);
    }

    valueFiled.values = new ArrayVector(streamValues);
    frame.addField(timeFiled);
    frame.addField(valueFiled);

    return frame;
  }

  queryActivitySplits(options: DataQueryRequest<StravaQuery>, target: StravaQuery, activity: any) {
    const timeFiled: MutableField<number> = {
      name: TIME_SERIES_TIME_FIELD_NAME,
      type: FieldType.time,
      config: {
        custom: {},
      },
      values: new ArrayVector(),
    };

    const splitStat = target.splitStat || '';

    const valueFiled: MutableField<number> = {
      name: splitStat || TIME_SERIES_VALUE_FIELD_NAME,
      type: FieldType.number,
      config: {
        custom: {},
      },
      values: new ArrayVector(),
    };

    const frame = new MutableDataFrame({
      name: activity.name,
      refId: target.refId,
      fields: [],
    });

    let ts = dateTime(activity.start_date).unix();
    if (target.fitToTimeRange) {
      ts = options.range.from.unix();
    }

    const splits: any[] = activity.splits_metric;
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      timeFiled.values.add(ts * 1000);
      let value = split[splitStat];
      if (splitStat === StravaSplitStat.Speed) {
        value = velocityToSpeed(value);
      }
      valueFiled.values.add(value);
      ts += split.moving_time;
    }

    frame.addField(timeFiled);
    frame.addField(valueFiled);

    return frame;
  }

  async metricFindQuery(query: VariableQuery, options?: any): Promise<MetricFindValue[]> {
    let activities = await this.stravaApi.getActivities({ limit: 100 });
    activities = this.filterActivities(activities, query.activityType);
    const variableOptions: MetricFindValue[] = activities.map((a) => ({
      value: a.id,
      text: a.name,
    }));
    return variableOptions;
  }

  async testDatasource() {
    const authCode = this.getAuthCode();
    if (authCode) {
      // Exchange auth code for new refresh token if "Connect with Strava" button clicked
      try {
        await this.stravaApi.exchangeToken(authCode);
      } catch (err) {
        console.log(err);
      }
    }

    try {
      await this.stravaApi.getActivities({ per_page: 2, limit: 2 });
      return { status: 'success', message: 'Data source is working' };
    } catch (err) {
      return { status: 'error', message: 'Cannot connect to Strava API' };
    }
  }

  getAuthCode() {
    const AuthCodePattern = /code=([\w]+)/;
    const result = AuthCodePattern.exec(window.location.search);
    const authCode = result && result.length && result[1];
    return authCode;
  }

  filterActivities(activities: any[], activityType: StravaActivityType): any[] {
    if (!activityType) {
      // No filter, return all
      return activities;
    }

    return activities.filter((activity) => {
      if (activityType === 'Other') {
        return activity.type !== 'Run' && activity.type !== 'Ride';
      } else {
      }
      return activity.type === activityType;
    });
  }

  transformActivitiesToTimeseries(data: any[], target: StravaQuery, range: TimeRange): TimeSeries {
    let datapoints: any[] = [];
    for (const activity of data) {
      datapoints.push([activity[target.activityStat], dateTime(activity.start_date).valueOf()]);
    }
    datapoints.sort((dpA, dpB) => dpA[1] - dpB[1]);
    if (target.interval !== StravaQueryInterval.No) {
      const aggInterval =
        !target.interval || target.interval === StravaQueryInterval.Auto
          ? getAggregationInterval(range)
          : getAggregationIntervalFromTarget(target);
      if (aggInterval >= INTERVAL_4w) {
        datapoints = groupByMonthSum(datapoints, range);
      } else if (aggInterval === INTERVAL_1w) {
        datapoints = groupByWeekSum(datapoints, range);
      } else {
        datapoints = groupBySum(datapoints, range, aggInterval);
      }
    }
    const alias = `${target.activityType ? target.activityType + '_' : ''}${target.activityStat}`;
    return {
      target: alias,
      datapoints,
    };
  }

  transformActivitiesToTable(data: any[], target: StravaQuery) {
    const frame = new MutableDataFrame({
      refId: target.refId,
      fields: [
        { name: 'time', type: FieldType.time },
        { name: 'name', type: FieldType.string },
        { name: 'distance', type: FieldType.number, config: { unit: 'lengthm' } },
        { name: 'moving_time', type: FieldType.number, config: { unit: 's' } },
        { name: 'elapsed_time', type: FieldType.number, config: { unit: 's' } },
        { name: 'total_elevation_gain', type: FieldType.number, config: { unit: 'lengthm' } },
        { name: 'kilojoules', type: FieldType.number, config: { unit: 'joule' } },
        { name: 'type', type: FieldType.string },
        { name: 'id', type: FieldType.string, config: { unit: 'none', custom: { hidden: true } } },
      ],
    });

    for (let i = 0; i < data.length; i++) {
      const activity = data[i];
      frame.add({
        time: dateTime(activity.start_date),
        name: activity.name,
        distance: activity.distance,
        moving_time: activity.moving_time,
        elapsed_time: activity.elapsed_time,
        total_elevation_gain: activity.total_elevation_gain,
        kilojoules: activity.kilojoules,
        type: activity.type,
        id: activity.id,
      });
    }
    return frame;
  }

  transformActivitiesToWorldMap(data: any[], target: StravaQuery) {
    const unit =
      target.activityStat === StravaActivityStat.Distance || target.activityStat === StravaActivityStat.ElevationGain
        ? 'lengthm'
        : 's';
    const table: TableData = {
      type: 'table',
      columns: [{ text: 'value', unit }, { text: 'name' }, { text: 'latitude' }, { text: 'longitude' }],
      rows: [],
    };

    for (const activity of data) {
      const middlePoint = getActivityMiddlePoint(activity);
      const latitude = middlePoint ? middlePoint[0] : activity.start_latitude;
      const longitude = middlePoint ? middlePoint[1] : activity.start_longitude;
      const row = [activity[target.activityStat], activity.name, latitude, longitude];
      if (activity.start_latitude && activity.start_longitude) {
        table.rows.push(row);
      }
    }
    return table;
  }
}

function getActivityMiddlePoint(activity: any): number[] | null {
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

const INTERVAL_1h = 3600000;
const INTERVAL_1d = 86400000;
const INTERVAL_1w = 604800000;
const INTERVAL_4w = 2419200000;

function getAggregationInterval(range: TimeRange): number {
  const interval = range.to.unix() - range.from.unix();
  const interval_ms = interval * 1000;
  switch (true) {
    // 4d
    case interval_ms <= 345600000:
      return INTERVAL_1h; // 1h
    // 90d
    case interval_ms <= 7776000000:
      return INTERVAL_1d; // 1d
    // 1y
    case interval_ms <= 31536000000:
      return INTERVAL_1w; // 1w
    default:
      return INTERVAL_4w; // 4w
  }
}

function getAggregationIntervalFromTarget(target: StravaQuery): number {
  switch (target.interval) {
    case StravaQueryInterval.Hour:
      return INTERVAL_1h;
    case StravaQueryInterval.Day:
      return INTERVAL_1d;
    case StravaQueryInterval.Week:
      return INTERVAL_1w;
    case StravaQueryInterval.Month:
      return INTERVAL_4w;
    default:
      return INTERVAL_4w;
  }
}

const POINT_VALUE = 0;
const POINT_TIMESTAMP = 1;

const AGG_SUM = (values: TimeSeriesValue[]) => {
  return values.reduce((acc, val) => acc! + val!);
};

export function groupBySum(datapoints: TimeSeriesPoints, range: TimeRange, interval: number): TimeSeriesPoints {
  return groupByTime(datapoints, range, interval, getPointTimeFrame, getNextTimeFrame, AGG_SUM);
}

export function groupByWeekSum(datapoints: TimeSeriesPoints, range: TimeRange): TimeSeriesPoints {
  return groupByTime(datapoints, range, null, getClosestWeek, getNextWeek, AGG_SUM);
}

export function groupByMonthSum(datapoints: TimeSeriesPoints, range: TimeRange): TimeSeriesPoints {
  return groupByTime(datapoints, range, null, getClosestMonth, getNextMonth, AGG_SUM);
}

export function groupByTime(
  datapoints: any[],
  range: TimeRange,
  interval: number | null,
  intervalFn: any,
  nextIntervalFn: any,
  groupByFn: any
): any[] {
  if (datapoints.length === 0) {
    return [];
  }

  const time_from = range.from.unix() * 1000;
  const time_to = range.to.unix() * 1000;
  let grouped_series: any[] = [];
  let frame_values: any[] = [];
  let frame_value;
  let frame_ts = datapoints.length ? intervalFn(time_from, interval) : 0;
  let point_frame_ts = frame_ts;
  let point;

  for (let i = 0; i < datapoints.length; i++) {
    point = datapoints[i];
    point_frame_ts = intervalFn(point[POINT_TIMESTAMP], interval);
    if (point_frame_ts === frame_ts) {
      frame_values.push(point[POINT_VALUE]);
    } else if (point_frame_ts > frame_ts) {
      frame_value = frame_values.length ? groupByFn(frame_values) : null;
      grouped_series.push([frame_value, frame_ts]);

      // Move frame window to next non-empty interval and fill empty by null
      frame_ts = nextIntervalFn(frame_ts, interval);
      while (frame_ts < point_frame_ts) {
        grouped_series.push([null, frame_ts]);
        frame_ts = nextIntervalFn(frame_ts, interval);
      }
      frame_values = [point[POINT_VALUE]];
    }
  }

  frame_value = groupByFn(frame_values);
  grouped_series.push([frame_value, frame_ts]);

  // Move frame window to end of time range and fill empty by null
  frame_ts = nextIntervalFn(frame_ts, interval);
  while (frame_ts < time_to) {
    grouped_series.push([null, frame_ts]);
    frame_ts = nextIntervalFn(frame_ts, interval);
  }

  return grouped_series;
}

function getPointTimeFrame(timestamp: any, ms_interval: any) {
  return Math.floor(timestamp / ms_interval) * ms_interval;
}

function getNextTimeFrame(timestamp: any, ms_interval: any) {
  return timestamp + ms_interval;
}

function getClosestMonth(timestamp: any): number {
  const month_time = dateTime(timestamp).startOf('month');
  return month_time.unix() * 1000;
}

function getNextMonth(timestamp: any): number {
  const next_month_time = dateTime(timestamp).add(1, 'month');
  return next_month_time.unix() * 1000;
}

function getClosestWeek(timestamp: any): number {
  // The first Monday after the Unix Epoch begins on Jan 5, 1970, 00:00.
  // This is a UNIX timestamp of 96 hours or 345600000 ms
  const FIRST_MONDAY_MS = 345600000;
  const week_ts = timestamp - FIRST_MONDAY_MS;
  return Math.floor(week_ts / INTERVAL_1w) * INTERVAL_1w + FIRST_MONDAY_MS;
}

function getNextWeek(timestamp: any): number {
  return timestamp + INTERVAL_1w;
}
