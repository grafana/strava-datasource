import { DataQuery, SelectableValue, DataSourceJsonData } from '@grafana/data';

export interface StravaJsonData extends DataSourceJsonData {
  clientID: string;
}

export interface StravaSecureJsonData {
  accessToken?: string;
  clientSecret: string;
  authCode: string;
}

export interface StravaQuery extends DataQuery {
  queryType: StravaQueryType;
  activityStat: StravaActivityStat;
  activityType: StravaActivityType;
  format: StravaQueryFormat;
}

export enum StravaQueryFormat {
  TimeSeries = 'time_series',
  Table = 'table',
  WorldMap = 'worldmap',
}

export enum StravaQueryType {
  Activities = 'Activities',
}

export enum StravaActivityStat {
  Distance = 'distance',
  MovingTime = 'moving_time',
  ElapsedTime = 'elapsed_time',
  ElevationGain = 'total_elevation_gain',
  AveragePower = 'average_watts',
}

export type StravaActivityType = string | null;
