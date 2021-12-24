import { DataQuery, DataSourceJsonData, SelectableValue } from '@grafana/data';

export interface StravaJsonData extends DataSourceJsonData {
  clientID: string;
  stravaAuthType: StravaAuthType;
}

export enum StravaAuthType {
  OAuth = 'oauth',
  RefreshToken = 'refresh_token',
}

export interface StravaAthlete {
  profile_medium: string;
  firstname: string;
  lastname: string;
  measurement_preference: StravaMeasurementPreference;
}

export enum StravaMeasurementPreference {
  Meters = 'meters',
  Feet = 'feet',
}

export interface StravaSecureJsonData {
  clientSecret: string;
  authCode: string;
  refreshToken: string;
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
  activityData?: string;
  splitStat?: StravaSplitStat;
  singleActivityStat?: string;
  fitToTimeRange?: boolean;
  extendedStats: string[];
}

export enum StravaQueryFormat {
  TimeSeries = 'time_series',
  Table = 'table',
  WorldMap = 'worldmap',
  Heatmap = 'heatmap',
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
  AverageHeartRate = 'average_heartrate',
}

export type StravaActivityType = string | null;

export enum StravaActivityData {
  Graph = 'graph',
  Splits = 'splits',
  Stats = 'stats',
  Geomap = 'geomap',
}

export enum StravaSplitStat {
  HeartRate = 'average_heartrate',
  Speed = 'average_speed',
  MovingTime = 'moving_time',
  ElapsedTime = 'elapsed_time',
}

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

export interface VariableQuery {
  queryType: VariableQueryTypes;
  activityType: string;
  limit: number;
}

export enum VariableQueryTypes {
  Activity = 'activity',
}
