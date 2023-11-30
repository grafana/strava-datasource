import {
  TimeRange,
  DataFrame,
  dateTime,
  MutableField,
  TIME_SERIES_TIME_FIELD_NAME,
  FieldType,
  ArrayVector,
  TIME_SERIES_VALUE_FIELD_NAME,
  MutableDataFrame,
  TimeSeriesPoints,
  TimeSeriesValue,
} from '@grafana/data';
import polyline from 'polyline';
import {
  StravaActivity,
  StravaQuery,
  StravaQueryInterval,
  StravaMeasurementPreference,
  StravaActivityStat,
} from 'types';
import {
  INTERVAL_1w,
  INTERVAL_4w,
  getAggregationInterval,
  getAggregationIntervalFromTarget,
  getPreferredDistance,
  getPreferredLength,
} from 'utils';

interface TransformOptions {
  measurementPreference: StravaMeasurementPreference;
}

export function transformActivitiesToTimeseries(
  activities: StravaActivity[],
  target: StravaQuery,
  range: TimeRange,
  options: TransformOptions
): DataFrame {
  const { measurementPreference } = options;
  let datapoints: any[] = [];
  for (const activity of activities) {
    const statValue = getActivityStat(activity, target.activityStat, measurementPreference);
    datapoints.push([statValue, dateTime(activity.start_date).valueOf()]);
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

  const timeFiled: MutableField<number> = {
    name: TIME_SERIES_TIME_FIELD_NAME,
    type: FieldType.time,
    config: {},
    values: new ArrayVector(),
  };

  const valueFiled: MutableField<number> = {
    name: TIME_SERIES_VALUE_FIELD_NAME,
    type: FieldType.number,
    config: {
      unit: getStatUnit(target.activityStat, measurementPreference),
    },
    values: new ArrayVector(),
  };

  for (let i = 0; i < datapoints.length; i++) {
    const dp = datapoints[i];
    timeFiled.values.add(dp[1]);
    valueFiled.values.add(dp[0]);
  }

  const alias = `${target.activityType ? target.activityType + '_' : ''}${target.activityStat}`;
  return new MutableDataFrame({
    name: alias,
    refId: target.refId,
    fields: [timeFiled, valueFiled],
  });
}

export function transformActivitiesToTable(
  activities: StravaActivity[],
  target: StravaQuery,
  options: TransformOptions
) {
  const { measurementPreference } = options;
  const distanceUnit = measurementPreference === StravaMeasurementPreference.Feet ? 'lengthmi' : 'lengthm';
  const lengthUnit = measurementPreference === StravaMeasurementPreference.Feet ? 'lengthft' : 'lengthm';

  const frame = new MutableDataFrame({
    refId: target.refId,
    fields: [
      { name: 'time', type: FieldType.time },
      { name: 'name', type: FieldType.string },
      { name: 'distance', type: FieldType.number, config: { unit: distanceUnit } },
      { name: 'moving time', type: FieldType.number, config: { unit: 'dthms' } },
      { name: 'elapsed time', type: FieldType.number, config: { unit: 'dthms' } },
      { name: 'heart rate', type: FieldType.number, config: { unit: 'none', decimals: 0 } },
      { name: 'elevation gain', type: FieldType.number, config: { unit: lengthUnit, decimals: 0 } },
      { name: 'kilojoules', type: FieldType.number, config: { unit: 'joule' } },
      { name: 'type', type: FieldType.string },
      { name: 'id', type: FieldType.string, config: { unit: 'none', custom: { hidden: true } } },
      { name: 'time_from', type: FieldType.number, config: { unit: 'none', decimals: 0, custom: { hidden: true } } },
      { name: 'time_to', type: FieldType.number, config: { unit: 'none', decimals: 0, custom: { hidden: true } } },
    ],
  });

  target.extendedStats?.forEach((stat) => {
    frame.addField({ name: stat });
  });

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];
    const dataRow: any = {
      time: dateTime(activity.start_date),
      name: activity.name,
      distance: getPreferredDistance(activity.distance, measurementPreference),
      'moving time': activity.moving_time,
      'elapsed time': activity.elapsed_time,
      'heart rate': activity.average_heartrate,
      'elevation gain': getPreferredLength(activity.total_elevation_gain, measurementPreference),
      kilojoules: activity.kilojoules,
      type: activity.sport_type,
      id: activity.id,
      time_from: dateTime(activity.start_date).unix() * 1000,
      time_to: (dateTime(activity.start_date).unix() + activity.elapsed_time) * 1000,
    };
    target.extendedStats?.forEach((stat) => {
      const statValue = (activity as any)[stat];
      if (statValue) {
        dataRow[stat] = statValue;
      }
    });
    frame.add(dataRow);
  }
  return frame;
}

export function transformActivitiesToGeomap(
  activities: StravaActivity[],
  target: StravaQuery,
  options: TransformOptions
) {
  const { measurementPreference } = options;
  const frame = new MutableDataFrame({
    name: 'activities',
    refId: target.refId,
    fields: [
      { name: 'name', type: FieldType.string },
      { name: 'latitude', type: FieldType.number },
      { name: 'longitude', type: FieldType.number },
      {
        name: 'value',
        type: FieldType.number,
        config: {
          unit: getStatUnit(target.activityStat, measurementPreference),
        },
      },
      { name: 'time', type: FieldType.time },
      { name: 'id', type: FieldType.string, config: { unit: 'none', custom: { hidden: true } } },
      { name: 'time_from', type: FieldType.number, config: { unit: 'none', decimals: 0, custom: { hidden: true } } },
      { name: 'time_to', type: FieldType.number, config: { unit: 'none', decimals: 0, custom: { hidden: true } } },
    ],
  });

  for (const activity of activities) {
    const middlePoint = getActivityMiddlePoint(activity);
    const latitude = middlePoint ? middlePoint[0] : activity.start_latlng[0];
    const longitude = middlePoint ? middlePoint[1] : activity.start_latlng[1];
    if (latitude && longitude) {
      frame.add({
        name: activity.name,
        value: getActivityStat(activity, target.activityStat, measurementPreference),
        latitude,
        longitude,
        time: dateTime(activity.start_date),
        id: activity.id,
        time_from: dateTime(activity.start_date).unix() * 1000,
        time_to: (dateTime(activity.start_date).unix() + activity.elapsed_time) * 1000,
      });
    }
  }
  return frame;
}

export function transformActivitiesToHeatmap(
  activities: StravaActivity[],
  target: StravaQuery,
  options: TransformOptions
) {
  const frame = new MutableDataFrame({
    name: 'heatmap',
    refId: target.refId,
    fields: [
      { name: 'latitude', type: FieldType.number },
      { name: 'longitude', type: FieldType.number },
      { name: 'value', type: FieldType.number },
    ],
  });

  for (const activity of activities) {
    const summaryPolyline = activity?.map?.summary_polyline;
    if (summaryPolyline) {
      const points = polyline.decode(summaryPolyline);
      for (let i = 0; i < points.length; i++) {
        frame.add({
          latitude: points[i][0],
          longitude: points[i][1],
          value: 1,
        });
      }
    }
  }
  return frame;
}

function getActivityStat(
  activity: StravaActivity,
  activityStat: StravaActivityStat,
  measurementPreference: StravaMeasurementPreference
) {
  if (activityStat === StravaActivityStat.Distance) {
    return getPreferredDistance(activity.distance, measurementPreference);
  } else if (activityStat === StravaActivityStat.ElevationGain) {
    return getPreferredLength(activity.total_elevation_gain, measurementPreference);
  } else {
    return activity[activityStat];
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

function getStatUnit(activityStat: StravaActivityStat, measurementPreference: StravaMeasurementPreference): string {
  if (activityStat === StravaActivityStat.Distance) {
    return measurementPreference === StravaMeasurementPreference.Feet ? 'lengthmi' : 'lengthm';
  }
  if (activityStat === StravaActivityStat.ElevationGain) {
    return measurementPreference === StravaMeasurementPreference.Feet ? 'lengthft' : 'lengthm';
  }
  if (activityStat === StravaActivityStat.ElapsedTime || activityStat === StravaActivityStat.MovingTime) {
    return 'dthms';
  }
  if (activityStat === StravaActivityStat.AveragePower) {
    return 'watt';
  }
  return 'none';
}

export function groupBySum(datapoints: TimeSeriesPoints, range: TimeRange, interval: number): TimeSeriesPoints {
  return groupByTime(datapoints, range, interval, getPointTimeFrame, getNextTimeFrame, AGG_SUM);
}

export function groupByWeekSum(datapoints: TimeSeriesPoints, range: TimeRange): TimeSeriesPoints {
  return groupByTime(datapoints, range, null, getClosestWeek, getNextWeek, AGG_SUM);
}

export function groupByMonthSum(datapoints: TimeSeriesPoints, range: TimeRange): TimeSeriesPoints {
  return groupByTime(datapoints, range, null, getClosestMonth, getNextMonth, AGG_SUM);
}

const POINT_VALUE = 0;
const POINT_TIMESTAMP = 1;

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

const AGG_SUM = (values: TimeSeriesValue[]) => {
  return values.reduce((acc, val) => acc! + val!);
};

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
