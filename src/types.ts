import { DataQuery, DataSourceJsonData } from '@grafana/data';

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
  activityId: number;
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
