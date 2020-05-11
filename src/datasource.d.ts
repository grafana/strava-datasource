import { DataQueryRequest, DataSourceApi, DataSourceInstanceSettings, TimeSeries, TableData, TimeRange, TimeSeriesPoints } from '@grafana/data';
import StravaApi from './stravaApi';
import { StravaJsonData, StravaQuery, StravaActivityType } from './types';
export default class StravaDatasource extends DataSourceApi<StravaQuery, StravaJsonData> {
    type: any;
    datasourceId: number;
    apiUrl: string;
    stravaApi: StravaApi;
    activities: any[];
    /** @ngInject */
    constructor(instanceSettings: DataSourceInstanceSettings<StravaJsonData>);
    query(options: DataQueryRequest<StravaQuery>): Promise<{
        data: any[];
    }>;
    testDatasource(): Promise<{
        status: string;
        message: string;
    }>;
    getAuthCode(): string | 0 | null;
    filterActivities(activities: any[], activityType: StravaActivityType): any[];
    transformActivitiesToTimeseries(data: any[], target: StravaQuery, range: TimeRange): TimeSeries;
    transformActivitiesToTable(data: any[], target: StravaQuery): TableData;
    transformActivitiesToWorldMap(data: any[], target: StravaQuery): TableData;
}
export declare function groupBySum(datapoints: TimeSeriesPoints, range: TimeRange, interval: number): TimeSeriesPoints;
export declare function groupByWeekSum(datapoints: TimeSeriesPoints, range: TimeRange): TimeSeriesPoints;
export declare function groupByMonthSum(datapoints: TimeSeriesPoints, range: TimeRange): TimeSeriesPoints;
export declare function groupByTime(datapoints: any[], range: TimeRange, interval: number | null, intervalFn: any, nextIntervalFn: any, groupByFn: any): any[];
