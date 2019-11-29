import { DataQuery, SelectableValue, DataSourceJsonData } from '@grafana/data';

export interface StravaJsonData extends DataSourceJsonData {
  clientID: string;
}

export interface StravaSecureJsonData {
  accessToken: string;
  clientSecret?: string;
}

export interface StravaQuery extends DataQuery {
  queryType: StravaQueryType;
  activityStat: StravaActivityStat;
}

export interface StravaQueryTypeOption {
  value: StravaQueryType;
  label: string;
  description?: string;
}

export interface StravaActivityStatOption {
  value: StravaActivityStat;
  label: string;
  description?: string;
}

export enum StravaQueryType {
  Activities = 'Activities',
}

export enum StravaActivityStat {
  Distance = 'distance',
  MovingTime = 'moving_time',
  ElapsedTime = 'elapsed_time',
  ElevationGain = 'total_elevation_gain',
}
