import { DataSourcePlugin } from '@grafana/data';
import StravaDatasource from './datasource';
import { StravaJsonData, StravaQuery } from './types';
export declare const plugin: DataSourcePlugin<StravaDatasource, StravaQuery, StravaJsonData>;
