import { DataQuery, DataSourceJsonData, SelectableValue } from '@grafana/data';

export interface StravaJsonData extends DataSourceJsonData {
  clientID: string;
  stravaAuthType: StravaAuthType;
  cacheTTL: string;
  oauthPassThru: boolean;
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
  splits_metric: any;
  splits_standard: any;
  segment_efforts: SegmentEffort[];
}

export interface SegmentEffort {
  id: number;
  achievements: Achievement[];
  average_heartrate: number;
  average_watts: number;
  distance: number;
  elapsed_time: number;
  end_index: number;
  hidden: boolean;
  max_heartrate: number;
  moving_time: number;
  name: string;
  pr_rank?: number;
  start_date: string;
  start_date_local: string;
  start_index: number;
  segment: Segment;
}

export interface Segment {
  id: number;
  activity_type: ActivityType;
  athlete_segment_stats: AthleteSegmentStats;
  average_grade: number;
  city: string;
  climb_category: number;
  country: string;
  distance: number;
  elevation_high: number;
  elevation_low: number;
  start_latlng: LatLng;
  end_latlng: LatLng;
  hazardous: boolean;
  maximum_grade: number;
  name: string;
  private: boolean;
  starred: boolean;
  xoms: XOMs;
}

export interface AthleteSegmentStats {
  effort_count: number;
  pr_activity_id: number;
  pr_date: string;
  pr_elapsed_time: number;
}

export interface XOMs {
  overall: string;
  kom: string;
  qom: string;
  destination: {
    href: string;
    name: string;
    type: string;
  };
}

export interface Achievement {
  rank: number;
  type: string;
  type_id: number;
}

export interface DataStream<T> {
  original_size: number;
  resolution: DataStreamResolution;
  series_type: DataStreamSeriesType;
  data: T[];
}

export type DataStreamSet<T> = Record<StreamType, DataStream<T>>;

export type DataStreamResolution = 'low' | 'medium' | 'high';

export type DataStreamSeriesType = 'distance' | 'time';

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
  segmentEffortId?: number;
  selectedSegmentEffort?: SelectableValue<number>;
  segmentData?: string;
  segmentGraph?: StravaActivityStream;
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
  SegmentEffort = 'SegmentEffort',
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
  Segments = 'segments',
}

export enum StravaSplitStat {
  Pace = 'pace',
  HeartRate = 'average_heartrate',
  Speed = 'average_speed',
  MovingTime = 'moving_time',
  ElapsedTime = 'elapsed_time',
}

export enum StravaActivityStream {
  Time = 'time',
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
  activityId: string;
}

export enum VariableQueryTypes {
  Activity = 'activity',
  SegmentEffort = 'segment_effort',
}

export const TopAchievementStat = 'top_achievement';

export const GRAPH_SMOOTH_WINDOW = 20;
