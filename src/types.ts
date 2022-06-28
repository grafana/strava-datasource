import { DataQuery, DataSourceJsonData, SelectableValue } from '@grafana/data';

export interface StravaJsonData extends DataSourceJsonData {
  clientID: string;
  stravaAuthType: StravaAuthType;
  cacheTTL: string;
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

export interface StravaActivity {
  id: number;
  external_id: string;
  athlete: MetaAthlete;
  achievement_count: number;
  average_cadence: number;
  average_heartrate: number;
  average_speed: number;
  upload_id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  elev_high: number;
  elev_low: number;
  type: ActivityType;
  start_date: string;
  start_date_local: string;
  timezone: string;
  start_latlng: LatLng;
  end_latlng: LatLng;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  total_photo_count: number;
  map: PolylineMap;
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  flagged: boolean;
  from_accepted_tag: boolean;
  workout_type: number;
  upload_id_str: string;
  max_speed: number;
  has_kudoed: boolean;
  hide_from_home: boolean;
  gear_id: string;
  kilojoules: number;
  max_heartrate: number;
  average_watts: number;
  device_watts: number;
  max_watts: number;
  weighted_average_watts: number;
  display_hide_heartrate_option: boolean;
  location_city: string | null;
  location_country: string | null;
  location_state: string | null;
  gear: any;
}

export type ActivityType =
  | 'AlpineSki'
  | 'BackcountrySki'
  | 'Canoeing'
  | 'Crossfit'
  | 'EBikeRide'
  | 'Elliptical'
  | 'Golf'
  | 'Handcycle'
  | 'Hike'
  | 'IceSkate'
  | 'InlineSkate'
  | 'Kayaking'
  | 'Kitesurf'
  | 'NordicSki'
  | 'Ride'
  | 'RockClimbing'
  | 'RollerSki'
  | 'Rowing'
  | 'Run'
  | 'Sail'
  | 'Skateboard'
  | 'Snowboard'
  | 'Snowshoe'
  | 'Soccer'
  | 'StairStepper'
  | 'StandUpPaddling'
  | 'Surfing'
  | 'Swim'
  | 'Velomobile'
  | 'VirtualRide'
  | 'VirtualRun'
  | 'Walk'
  | 'WeightTraining'
  | 'Wheelchair'
  | 'Windsurf'
  | 'Workout'
  | 'Yoga';

export interface MetaAthlete {
  id: number;
  resource_state: number;
}

export type LatLng = [number, number];

export interface PolylineMap {
  id: string;
  polyline: string;
  summary_polyline: string;
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
  WeightedAveragePower = 'weighted_average_watts',
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
  LatLng = 'latlng',
}

export type StreamType =
  | 'heartrate'
  | 'altitude'
  | 'distance'
  | 'cadence'
  | 'velocity_smooth'
  | 'latlng'
  | 'watts'
  | 'watts_calc'
  | 'temp'
  | 'moving'
  | 'grade_smooth'
  | 'grade_adjusted_distance'
  | 'time'
  | 'timer_time';

export interface VariableQuery {
  queryType: VariableQueryTypes;
  activityType: string;
  limit: number;
}

export enum VariableQueryTypes {
  Activity = 'activity',
}
