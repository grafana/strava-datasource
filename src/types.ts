import { DataQuery, SelectableValue, DataSourceJsonData } from '@grafana/data';

export interface StravaJsonData extends DataSourceJsonData {
  clientID: string;
}

export interface StravaSecureJsonData {
  accessToken: string;
  clientSecret?: string;
}

export interface StravaQuery extends DataQuery {
}
