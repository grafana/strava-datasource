import { DataQuery, DataSourceJsonData, SelectableValue } from '@grafana/data';

export interface StravaJsonData extends DataSourceJsonData {
  clientID: string;
}

export interface StravaSecureJsonData {
  clientSecret: string;
  authCode: string;
}

export interface StravaQuery extends DataQuery {
  queryType: StravaQueryType;
  activityStat: StravaActivityStat;
  activityType: StravaActivityType;
  format: StravaQueryFormat;
  interval: StravaQueryInterval;
  selectedActivity?: SelectableValue<number>;
  activityId?: number;
  activityGraph?: StravaActivityStream;
}

export enum StravaQueryFormat {
  TimeSeries = 'time_series',
  Table = 'table',
  WorldMap = 'worldmap',
}

export enum StravaQueryInterval {
  No = 'no',
  Auto = 'auto',
  Hour = 'hour',
  Day = 'day',
  Week = 'week',
  Month = 'month',
}

export enum StravaQueryType {
  Activities = 'Activities',
  Activity = 'Activity',
}

export enum StravaActivityStat {
  Distance = 'distance',
  MovingTime = 'moving_time',
  ElapsedTime = 'elapsed_time',
  ElevationGain = 'total_elevation_gain',
  AveragePower = 'average_watts',
}

export type StravaActivityType = string | null;

export enum StravaActivityStream {
  Distance = 'distance',
  HeartRate = 'heartrate',
  Altitude = 'altitude',
  Cadence = 'cadence',
  Velocity = 'velocity_smooth',
  // Special type for pace which actually calculated from velocity
  Pace = 'pace',
  Watts = 'watts',
  WattsCalc = 'watts_calc',
  Temp = 'temp',
  Moving = 'moving',
  GradeSmooth = 'grade_smooth',
  GradeAdjustedDistance = 'grade_adjusted_distance',
}
