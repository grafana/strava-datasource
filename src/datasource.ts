import {
  DataQueryRequest,
  DataSourceApi,
  DataSourceInstanceSettings,
  dateTime,
  TimeRange,
  TimeSeriesPoints,
  TimeSeriesValue,
  TIME_SERIES_TIME_FIELD_NAME,
  FieldType,
  MutableField,
  ArrayVector,
  MutableDataFrame,
  TIME_SERIES_VALUE_FIELD_NAME,
  MetricFindValue,
  DataFrame,
} from '@grafana/data';
import StravaApi from './stravaApi';
import polyline from './polyline';
import {
  StravaActivity,
  StravaActivityStat,
  StravaJsonData,
  StravaQuery,
  StravaQueryFormat,
  StravaActivityType,
  StravaQueryInterval,
  StravaQueryType,
  StravaActivityStream,
  StravaActivityData,
  StravaSplitStat,
  VariableQuery,
  StravaAuthType,
  StravaAthlete,
  StravaMeasurementPreference,
  TopAchievementStat,
  VariableQueryTypes,
  SegmentEffort,
} from './types';
import {
  smoothVelocityData,
  velocityDataToPace,
  velocityDataToSpeed,
  velocityToPace,
  velocityToSpeed,
  metersToFeet,
  metersToMiles,
  paceToMiles,
  metersDataToFeet,
} from 'utils';
import { getTemplateSrv } from '@grafana/runtime';

const DEFAULT_RANGE = {
  from: dateTime(),
  to: dateTime(),
  raw: {
    from: 'now',
    to: 'now',
  },
};

export const DEFAULT_LIMIT = 100;
// 5 min
export const DEFAULT_ACTIVITIES_CACHE_INTERVAL = 5 * 60;

export default class StravaDatasource extends DataSourceApi<StravaQuery, StravaJsonData> {
  type: any;
  datasourceId: number;
  stravaAuthType: StravaAuthType;
  apiUrl: string;
  stravaApi: StravaApi;
  activities: any[];
  athlete?: StravaAthlete;
  measurementPreference: StravaMeasurementPreference;

  constructor(instanceSettings: DataSourceInstanceSettings<StravaJsonData>) {
    super(instanceSettings);
    this.type = 'strava';
    this.datasourceId = instanceSettings.id;
    this.apiUrl = instanceSettings.url!;
    this.stravaApi = new StravaApi(this.datasourceId);
    this.activities = [];
    this.stravaAuthType = instanceSettings.jsonData.stravaAuthType;
    this.measurementPreference = StravaMeasurementPreference.Meters;
  }

  async query(options: DataQueryRequest<StravaQuery>) {
    const data: any[] = [];
    let activities: StravaActivity[] = [];

    if (!this.athlete) {
      this.athlete = await this.stravaApi.getAuthenticatedAthlete();
      this.measurementPreference = this.athlete?.measurement_preference || StravaMeasurementPreference.Meters;
    }

    let queryActivities = options.targets.some((t) => t.queryType === StravaQueryType.Activities);

    if (queryActivities) {
      let before = options.range?.to.unix();
      let after = options.range?.from.unix();
      // Round time to cache interval in order to hit cache
      before = Math.floor(before / DEFAULT_ACTIVITIES_CACHE_INTERVAL) * DEFAULT_ACTIVITIES_CACHE_INTERVAL;
      after = Math.floor(after / DEFAULT_ACTIVITIES_CACHE_INTERVAL) * DEFAULT_ACTIVITIES_CACHE_INTERVAL;
      activities = await this.stravaApi.getActivities({ before, after });
    }

    for (const target of options.targets) {
      if (target.hide) {
        continue;
      }

      if (target.queryType === StravaQueryType.Activities) {
        const filteredActivities = this.filterActivities(activities, target.activityType);
        switch (target.format) {
          case StravaQueryFormat.Table:
            const tableData = this.transformActivitiesToTable(filteredActivities, target);
            data.push(tableData);
            break;
          case StravaQueryFormat.WorldMap:
            const geomapData = this.transformActivitiesToGeomap(filteredActivities, target);
            data.push(geomapData);
            break;
          case StravaQueryFormat.Heatmap:
            const heatmapData = this.transformActivitiesToHeatmap(filteredActivities, target);
            data.push(heatmapData);
            break;
          default:
            const tsData = this.transformActivitiesToTimeseries(
              filteredActivities,
              target,
              options.range || DEFAULT_RANGE
            );
            data.push(tsData);
            break;
        }
      } else if (target.queryType === StravaQueryType.Activity) {
        const activityData = await this.queryActivity(options, target);
        data.push(activityData);
      } else if (target.queryType === StravaQueryType.SegmentEffort) {
        const segmentData = await this.queryActivitySegment(options, target);
        data.push(segmentData);
      }
    }

    return { data };
  }

  async queryActivity(options: DataQueryRequest<StravaQuery>, target: StravaQuery) {
    const activityId = getTemplateSrv().replace(target.activityId?.toString());
    const activity = await this.stravaApi.getActivity({
      id: activityId,
      include_all_efforts: true,
    });

    if (target.activityData === StravaActivityData.Stats) {
      return this.queryActivityStats(activity, target, options);
    }

    if (target.activityData === StravaActivityData.Splits) {
      return this.queryActivitySplits(activity, target, options);
    }

    if (target.activityData === StravaActivityData.Geomap) {
      return this.queryActivityGeomap(activity, target, options);
    }

    if (target.activityData === StravaActivityData.Segments) {
      return this.queryActivitySegments(activity, target, options);
    }

    let activityStream = target.activityGraph;
    if (activityStream === StravaActivityStream.Pace) {
      activityStream = StravaActivityStream.Velocity;
    }

    if (!activityStream) {
      return null;
    }

    const streams = await this.stravaApi.getActivityStreams({
      id: activityId,
      streamType: activityStream,
    });

    const timeFiled: MutableField<number> = {
      name: TIME_SERIES_TIME_FIELD_NAME,
      type: FieldType.time,
      config: {
        custom: {},
      },
      values: new ArrayVector(),
    };

    const valueFiled: MutableField<number | null> = {
      name: activityStream,
      type: FieldType.number,
      config: {
        custom: {},
      },
      values: new ArrayVector(),
    };

    const frame = new MutableDataFrame({
      name: activity.name,
      refId: target.refId,
      fields: [],
    });

    const stream = streams[activityStream];
    if (!stream) {
      return frame;
    }

    let ts = dateTime(activity.start_date).unix();
    if (target.fitToTimeRange) {
      ts = options.range.from.unix();
    }

    // Data comes as a kind of sparce array. Time stream contains offset of data
    // points, for example:
    // heartrate: [70,81,82,81,99,96,97,98,99]
    // time:      [0, 4, 5, 6, 20,21,22,23,24]
    // So last value of the time stream is a highest index in data array
    const timeStream = streams.time;
    const streamLength: number = streams.time?.data[streams.time?.data.length - 1] + 1;
    let streamValues = new Array<number | null>(streamLength).fill(null);

    for (let i = 0; i < streamLength; i++) {
      timeFiled.values.add(ts * 1000);
      streamValues[timeStream.data[i]] = stream.data[i];
      ts++;
    }

    if (target.activityGraph === StravaActivityStream.Pace) {
      if (activity.type === 'Run') {
        valueFiled.name = 'pace';
        valueFiled.config.unit = 'dthms';
        streamValues = velocityDataToPace(streamValues, this.measurementPreference);
      } else {
        valueFiled.name = 'speed';
        valueFiled.config.unit = getPreferredSpeedUnit(this.measurementPreference);
        streamValues = velocityDataToSpeed(streamValues, this.measurementPreference);
      }
    }

    if (target.activityGraph === StravaActivityStream.Velocity) {
      valueFiled.name = 'speed';
      valueFiled.config.unit = getPreferredSpeedUnit(this.measurementPreference);
      streamValues = velocityDataToSpeed(streamValues, this.measurementPreference);
    }

    if (target.activityGraph === StravaActivityStream.Altitude) {
      valueFiled.config.unit = getPreferredLenghtUnit(this.measurementPreference);
      streamValues = metersDataToFeet(streamValues, this.measurementPreference);
    }

    // Smooth data
    if (
      activityStream === StravaActivityStream.Velocity ||
      activityStream === StravaActivityStream.HeartRate ||
      activityStream === StravaActivityStream.GradeSmooth ||
      activityStream === StravaActivityStream.WattsCalc ||
      activityStream === StravaActivityStream.Watts
    ) {
      streamValues = smoothVelocityData(streamValues);
    }

    valueFiled.values = new ArrayVector(streamValues);
    frame.addField(timeFiled);
    frame.addField(valueFiled);

    return frame;
  }

  async queryActivitySegment(options: DataQueryRequest<StravaQuery>, target: StravaQuery) {
    const activityId = getTemplateSrv().replace(target.activityId?.toString());
    const segmentEffortId = getTemplateSrv().replace(target.segmentEffortId?.toString());
    const activity: StravaActivity = await this.stravaApi.getActivity({
      id: activityId,
      include_all_efforts: true,
    });

    const segmentEffort = activity.segment_efforts?.find((se) => se.id.toString() === segmentEffortId);
    if (!segmentEffort) {
      return [];
    }

    if (target.activityData === StravaActivityData.Geomap) {
      return this.querySegmentGeomap(activity, segmentEffort, target, options);
    }

    let segmentStream = target.segmentGraph;
    if (segmentStream === StravaActivityStream.Pace) {
      segmentStream = StravaActivityStream.Velocity;
    }

    if (!segmentStream) {
      return null;
    }

    const streams = await this.stravaApi.getActivityStreams({
      id: activityId,
      streamType: segmentStream,
    });

    const timeFiled: MutableField<number> = {
      name: TIME_SERIES_TIME_FIELD_NAME,
      type: FieldType.time,
      config: {
        custom: {},
      },
      values: new ArrayVector(),
    };

    const valueFiled: MutableField<number | null> = {
      name: segmentStream,
      type: FieldType.number,
      config: {
        custom: {},
      },
      values: new ArrayVector(),
    };

    const frame = new MutableDataFrame({
      name: activity.name,
      refId: target.refId,
      fields: [],
    });

    const stream = streams[segmentStream];
    if (!stream) {
      return frame;
    }

    // Data comes as a kind of sparce array. Time stream contains offset of data
    // points, for example:
    // heartrate: [70,81,82,81,99,96,97,98,99]
    // time:      [0, 4, 5, 6, 20,21,22,23,24]
    // So last value of the time stream is a highest index in data array
    const timeStream = streams.time;
    const streamLength: number = timeStream.data[segmentEffort.end_index] - timeStream.data[segmentEffort.start_index];
    let streamValues = new Array<number | null>(streamLength).fill(null);

    const firstTsIndex = timeStream.data[segmentEffort.start_index];
    let ts = dateTime(activity.start_date).unix() + firstTsIndex;
    if (target.fitToTimeRange) {
      ts = options.range.from.unix();
    }
    const startIdx = segmentEffort.start_index;
    for (let i = startIdx; i < startIdx + streamLength; i++) {
      timeFiled.values.add(ts * 1000);
      ts++;
    }
    for (let i = startIdx; i < segmentEffort.end_index; i++) {
      streamValues[timeStream.data[i] - firstTsIndex] = stream.data[i];
    }

    if (target.activityGraph === StravaActivityStream.Pace) {
      if (activity.type === 'Run') {
        valueFiled.name = 'pace';
        valueFiled.config.unit = 'dthms';
        streamValues = velocityDataToPace(streamValues, this.measurementPreference);
      } else {
        valueFiled.name = 'speed';
        valueFiled.config.unit = getPreferredSpeedUnit(this.measurementPreference);
        streamValues = velocityDataToSpeed(streamValues, this.measurementPreference);
      }
    }

    if (target.activityGraph === StravaActivityStream.Velocity) {
      valueFiled.name = 'speed';
      valueFiled.config.unit = getPreferredSpeedUnit(this.measurementPreference);
      streamValues = velocityDataToSpeed(streamValues, this.measurementPreference);
    }

    if (target.activityGraph === StravaActivityStream.Altitude) {
      valueFiled.config.unit = getPreferredLenghtUnit(this.measurementPreference);
      streamValues = metersDataToFeet(streamValues, this.measurementPreference);
    }

    // Smooth data
    if (
      segmentStream === StravaActivityStream.Velocity ||
      segmentStream === StravaActivityStream.HeartRate ||
      segmentStream === StravaActivityStream.GradeSmooth ||
      segmentStream === StravaActivityStream.WattsCalc ||
      segmentStream === StravaActivityStream.Watts
    ) {
      streamValues = smoothVelocityData(streamValues);
    }

    valueFiled.values = new ArrayVector(streamValues);
    frame.addField(timeFiled);
    frame.addField(valueFiled);

    return frame;
  }

  queryActivitySplits(activity: StravaActivity, target: StravaQuery, options: DataQueryRequest<StravaQuery>) {
    const timeFiled: MutableField<number> = {
      name: TIME_SERIES_TIME_FIELD_NAME,
      type: FieldType.time,
      config: {
        custom: {},
      },
      values: new ArrayVector(),
    };

    const splitStat = target.splitStat || '';

    const valueFiled: MutableField<number> = {
      name: splitStat || TIME_SERIES_VALUE_FIELD_NAME,
      type: FieldType.number,
      config: {},
      values: new ArrayVector(),
    };

    const frame = new MutableDataFrame({
      name: activity.name,
      refId: target.refId,
      fields: [],
    });

    let ts = dateTime(activity.start_date).unix();
    if (target.fitToTimeRange) {
      ts = options.range.from.unix();
    }

    const isMetric = this.measurementPreference === StravaMeasurementPreference.Meters;
    const splits: any[] = isMetric ? activity.splits_metric : activity.splits_standard;
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      timeFiled.values.add(ts * 1000);
      let value = split[splitStat];
      if (splitStat === StravaSplitStat.Speed) {
        value = velocityToSpeed(value);
      } else if (splitStat === StravaSplitStat.Pace) {
        if (activity.type === 'Run') {
          valueFiled.config.unit = 'dthms';
          value = getPreferredPace(split[StravaSplitStat.Speed], this.measurementPreference);
        } else {
          valueFiled.config.unit = getPreferredSpeedUnit(this.measurementPreference);
          value = getPreferredSpeed(split[StravaSplitStat.Speed], this.measurementPreference);
        }
      }
      valueFiled.values.add(value);
      ts += split.elapsed_time;
    }

    frame.addField(timeFiled);
    frame.addField(valueFiled);

    return frame;
  }

  queryActivityStats(activity: StravaActivity, target: StravaQuery, options: DataQueryRequest<StravaQuery>) {
    const stats = target.singleActivityStat || 'name';
    const valueFiled: MutableField<number | null> = {
      name: stats,
      type: FieldType.other,
      config: {},
      values: new ArrayVector(),
    };
    let activityStats = (activity as any)[stats];
    if (stats.startsWith('gear_')) {
      const gearStatsName = stats.substring('gear_'.length);
      activityStats = activity.gear ? activity.gear[gearStatsName] : null;
    }
    if (stats === 'pace') {
      if (activity.type === 'Run') {
        valueFiled.config.unit = 'dthms';
        activityStats = getPreferredPace(activity.average_speed, this.measurementPreference);
      } else {
        valueFiled.config.unit = getPreferredSpeedUnit(this.measurementPreference);
        activityStats = getPreferredSpeed(activity.average_speed, this.measurementPreference);
      }
    }
    if (stats === TopAchievementStat) {
      let topAchievement = null;
      for (const effort of activity.segment_efforts) {
        if (effort.achievements) {
          for (const achievement of effort.achievements) {
            if (topAchievement === null || achievement.rank < topAchievement) {
              topAchievement = achievement.rank;
            }
          }
        }
      }
      activityStats = topAchievement;
    }
    if (stats === StravaActivityStat.Distance) {
      valueFiled.config.unit = this.measurementPreference === StravaMeasurementPreference.Feet ? 'lengthmi' : 'lengthm';
      activityStats = getPreferredDistance(activity.distance, this.measurementPreference);
    }
    if (stats === StravaActivityStat.ElevationGain) {
      valueFiled.config.unit = this.measurementPreference === StravaMeasurementPreference.Feet ? 'lengthft' : 'lengthm';
      activityStats = getPreferredLenght(activity.total_elevation_gain, this.measurementPreference);
    }

    const frame = new MutableDataFrame({
      name: activity.name,
      refId: target.refId,
      fields: [{ name: TIME_SERIES_TIME_FIELD_NAME, type: FieldType.time }, valueFiled],
    });

    frame.add({
      time: dateTime(activity.start_date),
      [stats]: activityStats,
    });

    return frame;
  }

  async queryActivitySegments(activity: StravaActivity, target: StravaQuery, options: DataQueryRequest<StravaQuery>) {
    const distanceUnit = this.measurementPreference === StravaMeasurementPreference.Feet ? 'lengthmi' : 'lengthm';
    const lenghtUnit = this.measurementPreference === StravaMeasurementPreference.Feet ? 'lengthft' : 'lengthm';

    const frame = new MutableDataFrame({
      refId: target.refId,
      fields: [
        { name: 'name', type: FieldType.string },
        { name: 'achievements', type: FieldType.number, config: { unit: '', decimals: 0 } },
        { name: 'time', type: FieldType.number, config: { unit: 'dthms' } },
        { name: 'pace', type: FieldType.number, config: { unit: '' } },
        { name: 'heart rate', type: FieldType.number, config: { unit: 'bpm', decimals: 0 } },
        { name: 'power', type: FieldType.number, config: { unit: 'watt' } },
        { name: 'distance', type: FieldType.number, config: { unit: distanceUnit } },
        { name: 'elevation gain', type: FieldType.number, config: { unit: lenghtUnit, decimals: 0 } },
        { name: 'grade', type: FieldType.number, config: { unit: 'percent', decimals: 1 } },
        { name: 'PR', type: FieldType.string, config: { unit: 'dthms' } },
        { name: 'KOM', type: FieldType.string },
        { name: 'id', type: FieldType.string, config: { unit: 'none', custom: { hidden: true } } },
        { name: 'segment_id', type: FieldType.string, config: { unit: 'none', custom: { hidden: true } } },
        { name: 'time_from', type: FieldType.number, config: { unit: 'none', decimals: 0, custom: { hidden: true } } },
        { name: 'time_to', type: FieldType.number, config: { unit: 'none', decimals: 0, custom: { hidden: true } } },
      ],
    });

    const segments = activity.segment_efforts;
    if (segments?.length > 0) {
      let detailedSegments = await Promise.all(segments.map((s) => this.stravaApi.getSegment(s.segment.id)));

      for (let i = 0; i < segments.length; i++) {
        const effort = segments[i];
        const segment = detailedSegments.find((s) => s.id === effort.segment.id);

        const paceFieldIdx = frame.fields.findIndex((field) => field.name === 'pace');
        let pace: number;
        if (effort.segment.activity_type === 'Run') {
          frame.fields[paceFieldIdx].config.unit = 'dthms';
          pace = getPreferredPace(effort.distance / effort.moving_time, this.measurementPreference);
        } else {
          frame.fields[paceFieldIdx].config.unit = getPreferredSpeedUnit(this.measurementPreference);
          pace = getPreferredSpeed(effort.distance / effort.moving_time, this.measurementPreference);
        }

        const dataRow: any = {
          name: effort.name,
          achievements: effort.pr_rank,
          time: effort.moving_time,
          pace: pace,
          'heart rate': effort.average_heartrate,
          power: effort.average_watts,
          distance: getPreferredDistance(effort.distance, this.measurementPreference),
          'elevation gain': getPreferredLenght(
            effort.segment.elevation_high - effort.segment.elevation_low,
            this.measurementPreference
          ),
          grade: effort.segment.average_grade,
          PR: segment?.athlete_segment_stats?.pr_elapsed_time,
          KOM: segment?.xoms?.overall,
          id: effort.id,
          segment_id: effort.segment.id,
          time_from: dateTime(effort.start_date).unix() * 1000,
          time_to: (dateTime(effort.start_date).unix() + effort.elapsed_time) * 1000,
        };

        frame.add(dataRow);
      }
    }

    return frame;
  }

  async queryActivityGeomap(activity: any, target: StravaQuery, options: DataQueryRequest<StravaQuery>) {
    const frame = new MutableDataFrame({
      name: activity.name,
      refId: target.refId,
      fields: [
        { name: TIME_SERIES_VALUE_FIELD_NAME, type: FieldType.number },
        { name: 'latitude', type: FieldType.number },
        { name: 'longitude', type: FieldType.number },
      ],
    });

    let points: Array<[number, number]> = [];
    const summaryPolyline = activity?.map?.polyline;
    points = polyline.decode(summaryPolyline);

    try {
      const streams = await this.stravaApi.getActivityStreams({
        id: activity.id,
        streamType: StravaActivityStream.LatLng,
      });
      points = streams[StravaActivityStream.LatLng].data;
      let startTs = dateTime(activity.start_date).unix();
      const timeticks = streams.time?.data;
      if (!timeticks) {
        throw new Error('Time field not found');
      }
      frame.addField({ name: TIME_SERIES_TIME_FIELD_NAME, type: FieldType.time });
      for (let i = 0; i < points.length; i++) {
        frame.add({
          latitude: points[i][0],
          longitude: points[i][1],
          [TIME_SERIES_VALUE_FIELD_NAME]: 1,
          [TIME_SERIES_TIME_FIELD_NAME]: (startTs + timeticks[i]) * 1000,
        });
      }
    } catch (error) {
      console.log('Cannot fetch geo points from activity stream, switching to polyline.');
      for (let i = 0; i < points.length; i++) {
        frame.add({
          latitude: points[i][0],
          longitude: points[i][1],
          [TIME_SERIES_VALUE_FIELD_NAME]: 1,
        });
      }
    }

    return frame;
  }

  async querySegmentGeomap(
    activity: StravaActivity,
    segmentEffort: SegmentEffort,
    target: StravaQuery,
    options: DataQueryRequest<StravaQuery>
  ) {
    const frame = new MutableDataFrame({
      name: activity.name,
      refId: target.refId,
      fields: [
        { name: TIME_SERIES_VALUE_FIELD_NAME, type: FieldType.number },
        { name: 'latitude', type: FieldType.number },
        { name: 'longitude', type: FieldType.number },
      ],
    });

    if (!segmentEffort) {
      return frame;
    }

    let points: Array<[number, number]> = [];

    try {
      const streams = await this.stravaApi.getActivityStreams({
        id: activity.id,
        streamType: StravaActivityStream.LatLng,
      });
      points = streams[StravaActivityStream.LatLng].data;
      let startTs = dateTime(activity.start_date).unix();
      const timeticks = streams.time?.data;
      if (!timeticks) {
        throw new Error('Time field not found');
      }
      frame.addField({ name: TIME_SERIES_TIME_FIELD_NAME, type: FieldType.time });
      for (let i = segmentEffort.start_index; i < segmentEffort.end_index; i++) {
        frame.add({
          latitude: points[i][0],
          longitude: points[i][1],
          [TIME_SERIES_VALUE_FIELD_NAME]: 1,
          [TIME_SERIES_TIME_FIELD_NAME]: (startTs + timeticks[i]) * 1000,
        });
      }
    } catch (error) {
      console.log('Cannot fetch geo points from activity stream');
    }

    return frame;
  }

  async metricFindQuery(query: VariableQuery, options?: any): Promise<MetricFindValue[]> {
    const queryType = query.queryType;
    if (queryType === VariableQueryTypes.SegmentEffort) {
      const activityId = getTemplateSrv().replace(query.activityId);
      const activity: StravaActivity = await this.stravaApi.getActivity({
        id: activityId,
        include_all_efforts: true,
      });
      const segmentEfforts: MetricFindValue[] = [];
      for (const effort of activity.segment_efforts) {
        segmentEfforts.push({ value: effort.id, text: effort.name });
      }
      return segmentEfforts;
    } else {
      const limit = query.limit || DEFAULT_LIMIT;
      let activities = await this.stravaApi.getActivities({ limit });
      activities = this.filterActivities(activities, query.activityType);
      const variableOptions: MetricFindValue[] = activities.map((a) => ({
        value: a.id,
        text: a.name,
      }));
      return variableOptions;
    }
  }

  async testDatasource() {
    if (this.stravaAuthType !== StravaAuthType.RefreshToken) {
      const authCode = this.getAuthCodeFromLocation();
      if (authCode) {
        // Exchange auth code for new refresh token if "Connect with Strava" button clicked
        try {
          await this.stravaApi.exchangeToken(authCode);
        } catch (err) {
          console.log(err);
        }
      }
    }

    try {
      await this.stravaApi.resetAccessToken();
      await this.stravaApi.resetCache();
      const athlete = await this.stravaApi.getAuthenticatedAthlete();
      if (!athlete) {
        return { status: 'error', message: `Cannot get authenticated user.` };
      }
      return {
        status: 'success',
        message: `Data source is working. Authenticated as ${athlete.firstname} ${athlete.lastname}.`,
      };
    } catch (err: any) {
      const message = err?.data?.message || '';
      return { status: 'error', message: `Cannot connect to Strava API${message ? ': ' + message : ''}` };
    }
  }

  getAuthCodeFromLocation() {
    const AuthCodePattern = /code=([\w]+)/;
    const result = AuthCodePattern.exec(window.location.search);
    const authCode = result && result.length && result[1];
    return authCode;
  }

  filterActivities(activities: any[], activityType: StravaActivityType): any[] {
    if (!activityType) {
      // No filter, return all
      return activities;
    }

    return activities.filter((activity) => {
      if (activityType === 'Other') {
        return activity.type !== 'Run' && activity.type !== 'Ride';
      } else {
      }
      return activity.type === activityType;
    });
  }

  transformActivitiesToTimeseries(activities: StravaActivity[], target: StravaQuery, range: TimeRange): DataFrame {
    let datapoints: any[] = [];
    for (const activity of activities) {
      const statValue = getActivityStat(activity, target.activityStat, this.measurementPreference);
      datapoints.push([statValue, dateTime(activity.start_date).valueOf()]);
    }
    datapoints.sort((dpA, dpB) => dpA[1] - dpB[1]);

    if (target.interval !== StravaQueryInterval.No) {
      const aggInterval =
        !target.interval || target.interval === StravaQueryInterval.Auto
          ? getAggregationInterval(range)
          : getAggregationIntervalFromTarget(target);
      if (aggInterval >= INTERVAL_4w) {
        datapoints = groupByMonthSum(datapoints, range);
      } else if (aggInterval === INTERVAL_1w) {
        datapoints = groupByWeekSum(datapoints, range);
      } else {
        datapoints = groupBySum(datapoints, range, aggInterval);
      }
    }

    const timeFiled: MutableField<number> = {
      name: TIME_SERIES_TIME_FIELD_NAME,
      type: FieldType.time,
      config: {},
      values: new ArrayVector(),
    };

    const valueFiled: MutableField<number> = {
      name: TIME_SERIES_VALUE_FIELD_NAME,
      type: FieldType.number,
      config: {
        unit: getStatUnit(target.activityStat, this.measurementPreference),
      },
      values: new ArrayVector(),
    };

    for (let i = 0; i < datapoints.length; i++) {
      const dp = datapoints[i];
      timeFiled.values.add(dp[1]);
      valueFiled.values.add(dp[0]);
    }

    const alias = `${target.activityType ? target.activityType + '_' : ''}${target.activityStat}`;
    return new MutableDataFrame({
      name: alias,
      refId: target.refId,
      fields: [timeFiled, valueFiled],
    });
  }

  transformActivitiesToTable(activities: StravaActivity[], target: StravaQuery) {
    const distanceUnit = this.measurementPreference === StravaMeasurementPreference.Feet ? 'lengthmi' : 'lengthm';
    const lenghtUnit = this.measurementPreference === StravaMeasurementPreference.Feet ? 'lengthft' : 'lengthm';

    const frame = new MutableDataFrame({
      refId: target.refId,
      fields: [
        { name: 'time', type: FieldType.time },
        { name: 'name', type: FieldType.string },
        { name: 'distance', type: FieldType.number, config: { unit: distanceUnit } },
        { name: 'moving time', type: FieldType.number, config: { unit: 'dthms' } },
        { name: 'elapsed time', type: FieldType.number, config: { unit: 'dthms' } },
        { name: 'heart rate', type: FieldType.number, config: { unit: 'none', decimals: 0 } },
        { name: 'elevation gain', type: FieldType.number, config: { unit: lenghtUnit, decimals: 0 } },
        { name: 'kilojoules', type: FieldType.number, config: { unit: 'joule' } },
        { name: 'type', type: FieldType.string },
        { name: 'id', type: FieldType.string, config: { unit: 'none', custom: { hidden: true } } },
        { name: 'time_from', type: FieldType.number, config: { unit: 'none', decimals: 0, custom: { hidden: true } } },
        { name: 'time_to', type: FieldType.number, config: { unit: 'none', decimals: 0, custom: { hidden: true } } },
      ],
    });

    target.extendedStats?.forEach((stat) => {
      frame.addField({ name: stat });
    });

    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      const dataRow: any = {
        time: dateTime(activity.start_date),
        name: activity.name,
        distance: getPreferredDistance(activity.distance, this.measurementPreference),
        'moving time': activity.moving_time,
        'elapsed time': activity.elapsed_time,
        'heart rate': activity.average_heartrate,
        'elevation gain': getPreferredLenght(activity.total_elevation_gain, this.measurementPreference),
        kilojoules: activity.kilojoules,
        type: activity.type,
        id: activity.id,
        time_from: dateTime(activity.start_date).unix() * 1000,
        time_to: (dateTime(activity.start_date).unix() + activity.elapsed_time) * 1000,
      };
      target.extendedStats?.forEach((stat) => {
        const statValue = (activity as any)[stat];
        if (statValue) {
          dataRow[stat] = statValue;
        }
      });
      frame.add(dataRow);
    }
    return frame;
  }

  transformActivitiesToGeomap(activities: StravaActivity[], target: StravaQuery) {
    const frame = new MutableDataFrame({
      name: 'activities',
      refId: target.refId,
      fields: [
        { name: 'name', type: FieldType.string },
        { name: 'latitude', type: FieldType.number },
        { name: 'longitude', type: FieldType.number },
        {
          name: 'value',
          type: FieldType.number,
          config: {
            unit: getStatUnit(target.activityStat, this.measurementPreference),
          },
        },
      ],
    });

    for (const activity of activities) {
      const middlePoint = getActivityMiddlePoint(activity);
      const latitude = middlePoint ? middlePoint[0] : activity.start_latlng[0];
      const longitude = middlePoint ? middlePoint[1] : activity.start_latlng[1];
      if (latitude && longitude) {
        frame.add({
          name: activity.name,
          value: getActivityStat(activity, target.activityStat, this.measurementPreference),
          latitude,
          longitude,
        });
      }
    }
    return frame;
  }

  transformActivitiesToHeatmap(activities: StravaActivity[], target: StravaQuery) {
    const frame = new MutableDataFrame({
      name: 'heatmap',
      refId: target.refId,
      fields: [
        { name: 'latitude', type: FieldType.number },
        { name: 'longitude', type: FieldType.number },
        { name: 'value', type: FieldType.number },
      ],
    });

    for (const activity of activities) {
      const summaryPolyline = activity?.map?.summary_polyline;
      if (summaryPolyline) {
        const points = polyline.decode(summaryPolyline);
        for (let i = 0; i < points.length; i++) {
          frame.add({
            latitude: points[i][0],
            longitude: points[i][1],
            value: 1,
          });
        }
      }
    }
    return frame;
  }
}

function getActivityMiddlePoint(activity: any): number[] | null {
  if (!activity.map || !activity.map.summary_polyline) {
    return null;
  }

  const summaryPolyline = activity.map.summary_polyline;
  const points = polyline.decode(summaryPolyline);
  if (points && points.length) {
    const middleIndex = Math.floor(points.length / 2);
    return points[middleIndex];
  } else {
    return null;
  }
}

const INTERVAL_1h = 3600000;
const INTERVAL_1d = 86400000;
const INTERVAL_1w = 604800000;
const INTERVAL_4w = 2419200000;

function getAggregationInterval(range: TimeRange): number {
  const interval = range.to.unix() - range.from.unix();
  const interval_ms = interval * 1000;
  switch (true) {
    // 4d
    case interval_ms <= 345600000:
      return INTERVAL_1h; // 1h
    // 90d
    case interval_ms <= 7776000000:
      return INTERVAL_1d; // 1d
    // 1y
    case interval_ms <= 31536000000:
      return INTERVAL_1w; // 1w
    default:
      return INTERVAL_4w; // 4w
  }
}

function getAggregationIntervalFromTarget(target: StravaQuery): number {
  switch (target.interval) {
    case StravaQueryInterval.Hour:
      return INTERVAL_1h;
    case StravaQueryInterval.Day:
      return INTERVAL_1d;
    case StravaQueryInterval.Week:
      return INTERVAL_1w;
    case StravaQueryInterval.Month:
      return INTERVAL_4w;
    default:
      return INTERVAL_4w;
  }
}

const POINT_VALUE = 0;
const POINT_TIMESTAMP = 1;

const AGG_SUM = (values: TimeSeriesValue[]) => {
  return values.reduce((acc, val) => acc! + val!);
};

export function groupBySum(datapoints: TimeSeriesPoints, range: TimeRange, interval: number): TimeSeriesPoints {
  return groupByTime(datapoints, range, interval, getPointTimeFrame, getNextTimeFrame, AGG_SUM);
}

export function groupByWeekSum(datapoints: TimeSeriesPoints, range: TimeRange): TimeSeriesPoints {
  return groupByTime(datapoints, range, null, getClosestWeek, getNextWeek, AGG_SUM);
}

export function groupByMonthSum(datapoints: TimeSeriesPoints, range: TimeRange): TimeSeriesPoints {
  return groupByTime(datapoints, range, null, getClosestMonth, getNextMonth, AGG_SUM);
}

export function groupByTime(
  datapoints: any[],
  range: TimeRange,
  interval: number | null,
  intervalFn: any,
  nextIntervalFn: any,
  groupByFn: any
): any[] {
  if (datapoints.length === 0) {
    return [];
  }

  const time_from = range.from.unix() * 1000;
  const time_to = range.to.unix() * 1000;
  let grouped_series: any[] = [];
  let frame_values: any[] = [];
  let frame_value;
  let frame_ts = datapoints.length ? intervalFn(time_from, interval) : 0;
  let point_frame_ts = frame_ts;
  let point;

  for (let i = 0; i < datapoints.length; i++) {
    point = datapoints[i];
    point_frame_ts = intervalFn(point[POINT_TIMESTAMP], interval);
    if (point_frame_ts === frame_ts) {
      frame_values.push(point[POINT_VALUE]);
    } else if (point_frame_ts > frame_ts) {
      frame_value = frame_values.length ? groupByFn(frame_values) : null;
      grouped_series.push([frame_value, frame_ts]);

      // Move frame window to next non-empty interval and fill empty by null
      frame_ts = nextIntervalFn(frame_ts, interval);
      while (frame_ts < point_frame_ts) {
        grouped_series.push([null, frame_ts]);
        frame_ts = nextIntervalFn(frame_ts, interval);
      }
      frame_values = [point[POINT_VALUE]];
    }
  }

  frame_value = groupByFn(frame_values);
  grouped_series.push([frame_value, frame_ts]);

  // Move frame window to end of time range and fill empty by null
  frame_ts = nextIntervalFn(frame_ts, interval);
  while (frame_ts < time_to) {
    grouped_series.push([null, frame_ts]);
    frame_ts = nextIntervalFn(frame_ts, interval);
  }

  return grouped_series;
}

function getPointTimeFrame(timestamp: any, ms_interval: any) {
  return Math.floor(timestamp / ms_interval) * ms_interval;
}

function getNextTimeFrame(timestamp: any, ms_interval: any) {
  return timestamp + ms_interval;
}

function getClosestMonth(timestamp: any): number {
  const month_time = dateTime(timestamp).startOf('month');
  return month_time.unix() * 1000;
}

function getNextMonth(timestamp: any): number {
  const next_month_time = dateTime(timestamp).add(1, 'month');
  return next_month_time.unix() * 1000;
}

function getClosestWeek(timestamp: any): number {
  // The first Monday after the Unix Epoch begins on Jan 5, 1970, 00:00.
  // This is a UNIX timestamp of 96 hours or 345600000 ms
  const FIRST_MONDAY_MS = 345600000;
  const week_ts = timestamp - FIRST_MONDAY_MS;
  return Math.floor(week_ts / INTERVAL_1w) * INTERVAL_1w + FIRST_MONDAY_MS;
}

function getNextWeek(timestamp: any): number {
  return timestamp + INTERVAL_1w;
}

function getPreferredDistance(value: number, measurementPreference: StravaMeasurementPreference): number {
  return measurementPreference === StravaMeasurementPreference.Feet ? metersToMiles(value) : value;
}

function getPreferredLenght(value: number, measurementPreference: StravaMeasurementPreference): number {
  return measurementPreference === StravaMeasurementPreference.Feet ? metersToFeet(value) : value;
}

function getPreferredSpeed(value: number, measurementPreference: StravaMeasurementPreference): number {
  const speedKmph = velocityToSpeed(value);
  return measurementPreference === StravaMeasurementPreference.Feet ? metersToMiles(speedKmph * 1000) : speedKmph;
}

function getPreferredSpeedUnit(measurementPreference: StravaMeasurementPreference) {
  return measurementPreference === StravaMeasurementPreference.Feet ? 'velocitymph' : 'velocitykmh';
}

function getPreferredLenghtUnit(measurementPreference: StravaMeasurementPreference) {
  return measurementPreference === StravaMeasurementPreference.Feet ? 'lengthft' : 'lengthm';
}

function getPreferredPace(value: number, measurementPreference: StravaMeasurementPreference): number {
  const paceMinkm = velocityToPace(value);
  return measurementPreference === StravaMeasurementPreference.Feet ? paceToMiles(paceMinkm) : paceMinkm;
}

function getActivityStat(
  activity: StravaActivity,
  activityStat: StravaActivityStat,
  measurementPreference: StravaMeasurementPreference
) {
  if (activityStat === StravaActivityStat.Distance) {
    return getPreferredDistance(activity.distance, measurementPreference);
  } else if (activityStat === StravaActivityStat.ElevationGain) {
    return getPreferredLenght(activity.total_elevation_gain, measurementPreference);
  } else {
    return activity[activityStat];
  }
}

function getStatUnit(activityStat: StravaActivityStat, measurementPreference: StravaMeasurementPreference): string {
  if (activityStat === StravaActivityStat.Distance) {
    return measurementPreference === StravaMeasurementPreference.Feet ? 'lengthmi' : 'lengthm';
  }
  if (activityStat === StravaActivityStat.ElevationGain) {
    return measurementPreference === StravaMeasurementPreference.Feet ? 'lengthft' : 'lengthm';
  }
  if (activityStat === StravaActivityStat.ElapsedTime || activityStat === StravaActivityStat.MovingTime) {
    return 'dthms';
  }
  if (activityStat === StravaActivityStat.AveragePower) {
    return 'watt';
  }
  return 'none';
}
