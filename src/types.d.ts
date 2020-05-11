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
}
export declare enum StravaQueryFormat {
    TimeSeries = "time_series",
    Table = "table",
    WorldMap = "worldmap"
}
export declare enum StravaQueryInterval {
    No = "no",
    Auto = "auto",
    Hour = "hour",
    Day = "day",
    Week = "week",
    Month = "month"
}
export declare enum StravaQueryType {
    Activities = "Activities"
}
export declare enum StravaActivityStat {
    Distance = "distance",
    MovingTime = "moving_time",
    ElapsedTime = "elapsed_time",
    ElevationGain = "total_elevation_gain",
    AveragePower = "average_watts"
}
export declare type StravaActivityType = string | null;
