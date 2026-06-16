import {
  DataQueryRequest,
  DataSourceApi,
  DataSourceInstanceSettings,
  dateTime,
  TIME_SERIES_TIME_FIELD_NAME,
  FieldType,
  MutableField,
  MutableDataFrame,
  TIME_SERIES_VALUE_FIELD_NAME,
  MetricFindValue,
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
  StravaQueryType,
  StravaActivityStream,
  StravaActivityData,
  StravaSplitStat,
  VariableQuery,
  StravaAthlete,
  StravaMeasurementPreference,
  TopAchievementStat,
  VariableQueryTypes,
  SegmentEffort,
  getRideTypes,
  getRunTypes,
  getWalkTypes,
} from './types';
import {
  smoothVelocityData,
  velocityDataToPace,
  velocityDataToSpeed,
  velocityToSpeed,
  metersDataToFeet,
  expandDataStream,
  getPreferredDistance,
  getPreferredLength,
  getPreferredLengthUnit,
  getPreferredPace,
  getPreferredSpeed,
  getPreferredSpeedUnit,
} from 'utils';
import { getTemplateSrv } from '@grafana/runtime';
import {
  transformActivitiesToGeomap,
  transformActivitiesToHeatmap,
  transformActivitiesToTable,
  transformActivitiesToTimeseries,
} from 'responseHandler';

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
  apiUrl: string;
  stravaApi: StravaApi;
  activities: any[];
  athlete?: StravaAthlete;
  measurementPreference: StravaMeasurementPreference;
  oauthPassThru: boolean;

  constructor(instanceSettings: DataSourceInstanceSettings<StravaJsonData>) {
    super(instanceSettings);
    this.type = 'strava';
    this.datasourceId = instanceSettings.id;
    this.apiUrl = instanceSettings.url!;
    this.stravaApi = new StravaApi(this.datasourceId);
    this.activities = [];
    this.measurementPreference = StravaMeasurementPreference.Meters;
    this.oauthPassThru = instanceSettings.jsonData.oauthPassThru;
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
        const transformOptions = { measurementPreference: this.measurementPreference };
        switch (target.format) {
          case StravaQueryFormat.Table:
            const tableData = transformActivitiesToTable(filteredActivities, target, transformOptions);
            data.push(tableData);
            break;
          case StravaQueryFormat.WorldMap:
            const geomapData = transformActivitiesToGeomap(filteredActivities, target, transformOptions);
            data.push(geomapData);
            break;
          case StravaQueryFormat.Heatmap:
            const heatmapData = transformActivitiesToHeatmap(filteredActivities, target, transformOptions);
            data.push(heatmapData);
            break;
          default:
            const tsData = transformActivitiesToTimeseries(
              filteredActivities,
              target,
              options.range || DEFAULT_RANGE,
              transformOptions
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
      streamTypes: [activityStream],
    });

    const timeFiled: MutableField<number> = {
      name: TIME_SERIES_TIME_FIELD_NAME,
      type: FieldType.time,
      config: {
        custom: {},
      },
      values: [],
    };

    const valueFiled: MutableField<number | null> = {
      name: activityStream,
      type: FieldType.number,
      config: {
        custom: {},
      },
      values: [],
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

    const streamLength = streams.time?.original_size || streams.time?.data[streams.time?.data.length - 1] + 1;
    let startTS = dateTime(activity.start_date).unix();
    if (target.fitToTimeRange) {
      startTS = options.range.from.unix();
    }

    let [streamValues, segmentTicks] = expandDataStream(stream, streams.time, startTS, 0, streamLength - 1);
    timeFiled.values = segmentTicks;

    if (target.activityGraph === StravaActivityStream.Pace) {
      if (activity.sport_type === 'Run') {
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
      valueFiled.config.unit = getPreferredLengthUnit(this.measurementPreference);
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

    valueFiled.values = streamValues;
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
      streamTypes: [segmentStream],
    });

    const timeFiled: MutableField<number> = {
      name: TIME_SERIES_TIME_FIELD_NAME,
      type: FieldType.time,
      config: {
        custom: {},
      },
      values: [],
    };

    const valueFiled: MutableField<number | null> = {
      name: segmentStream,
      type: FieldType.number,
      config: {
        custom: {},
      },
      values: [],
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

    let [streamValues, segmentTicks] = expandDataStream(
      streams[segmentStream],
      streams.time,
      dateTime(activity.start_date).unix(),
      segmentEffort.start_index,
      segmentEffort.end_index
    );

    timeFiled.values = segmentTicks;

    if (target.activityGraph === StravaActivityStream.Pace) {
      if (activity.sport_type === 'Run') {
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
      valueFiled.config.unit = getPreferredLengthUnit(this.measurementPreference);
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

    valueFiled.values = streamValues;
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
      values: [],
    };

    const splitStat = target.splitStat || '';

    const valueFiled: MutableField<number> = {
      name: splitStat || TIME_SERIES_VALUE_FIELD_NAME,
      type: FieldType.number,
      config: {},
      values: [],
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
        if (activity.sport_type === 'Run') {
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
      values: [],
    };
    let activityStats = (activity as any)[stats];
    if (stats.startsWith('gear_')) {
      const gearStatsName = stats.substring('gear_'.length);
      activityStats = activity.gear ? activity.gear[gearStatsName] : null;
    }
    if (stats === 'pace') {
      if (activity.sport_type === 'Run') {
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
      activityStats = getPreferredLength(activity.total_elevation_gain, this.measurementPreference);
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
    const lengthUnit = this.measurementPreference === StravaMeasurementPreference.Feet ? 'lengthft' : 'lengthm';

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
        { name: 'elevation gain', type: FieldType.number, config: { unit: lengthUnit, decimals: 0 } },
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
          'elevation gain': getPreferredLength(
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
        { name: TIME_SERIES_TIME_FIELD_NAME, type: FieldType.time },
        { name: 'latitude', type: FieldType.number },
        { name: 'longitude', type: FieldType.number },
        { name: 'velocity', type: FieldType.number },
        { name: 'altitude', type: FieldType.number },
        { name: 'grade', type: FieldType.number },
        { name: 'heartrate', type: FieldType.number },
      ],
    });

    let points: Array<[number, number]> = [];
    const summaryPolyline = activity?.map?.polyline;
    points = polyline.decode(summaryPolyline);

    try {
      const streams = await this.stravaApi.getActivityStreams({
        id: activity.id,
        streamTypes: [
          StravaActivityStream.LatLng,
          StravaActivityStream.Velocity,
          StravaActivityStream.Altitude,
          StravaActivityStream.GradeSmooth,
          StravaActivityStream.HeartRate,
        ],
      });

      points = streams[StravaActivityStream.LatLng].data;
      let startTs = dateTime(activity.start_date).unix();
      const timeticks = streams.time?.data;
      if (!timeticks) {
        throw new Error('Time field not found');
      }

      for (let i = 0; i < points.length; i++) {
        frame.add({
          latitude: points[i][0],
          longitude: points[i][1],
          velocity: streams[StravaActivityStream.Velocity]?.data[i],
          altitude: streams[StravaActivityStream.Altitude]?.data[i],
          grade: streams[StravaActivityStream.GradeSmooth]?.data[i],
          heartrate: streams[StravaActivityStream.HeartRate]?.data[i],
          [TIME_SERIES_TIME_FIELD_NAME]: (startTs + timeticks[i]) * 1000,
        });
      }
    } catch (error) {
      console.log('Cannot fetch geo points from activity stream, switching to polyline.');
      for (let i = 0; i < points.length; i++) {
        frame.add({
          latitude: points[i][0],
          longitude: points[i][1],
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
        { name: TIME_SERIES_TIME_FIELD_NAME, type: FieldType.time },
        { name: 'latitude', type: FieldType.number },
        { name: 'longitude', type: FieldType.number },
        { name: 'velocity', type: FieldType.number },
        { name: 'altitude', type: FieldType.number },
        { name: 'grade', type: FieldType.number },
        { name: 'heartrate', type: FieldType.number },
      ],
    });

    if (!segmentEffort) {
      return frame;
    }

    try {
      const streams = await this.stravaApi.getActivityStreams({
        id: activity.id,
        streamTypes: [
          StravaActivityStream.LatLng,
          StravaActivityStream.Velocity,
          StravaActivityStream.Altitude,
          StravaActivityStream.GradeSmooth,
          StravaActivityStream.HeartRate,
        ],
      });

      const geoStream = streams[StravaActivityStream.LatLng];
      const points = geoStream.data.slice(segmentEffort.start_index, segmentEffort.end_index);
      const timeticks = streams.time.data.slice(segmentEffort.start_index, segmentEffort.end_index);
      let startTs = dateTime(activity.start_date).unix();

      for (let i = 0; i < points.length; i++) {
        frame.add({
          latitude: points[i][0],
          longitude: points[i][1],
          velocity: streams[StravaActivityStream.Velocity]?.data[i],
          altitude: streams[StravaActivityStream.Altitude]?.data[i],
          grade: streams[StravaActivityStream.GradeSmooth]?.data[i],
          heartrate: streams[StravaActivityStream.HeartRate]?.data[i],
          [TIME_SERIES_TIME_FIELD_NAME]: (startTs + timeticks[i]) * 1000,
        });
      }
    } catch (error) {
      console.log('Cannot fetch geo points from activity stream', error);
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
    if (!this.oauthPassThru) {
      await this.stravaApi.resetCache();
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

  filterActivities(activities: StravaActivity[], activityType: StravaActivityType): any[] {
    if (!activityType) {
      // No filter, return all
      return activities;
    }

    return activities.filter((activity) => {
      const sportType = activity.sport_type;
      if (activityType === 'Ride') {
        return getRideTypes().includes(sportType);
      } else if (activityType === 'Run') {
        return getRunTypes().includes(sportType);
      } else if (activityType === 'Walk') {
        return getWalkTypes().includes(sportType);
      } else if (activityType === 'Other') {
        const otherTypes = getRideTypes().concat(getRunTypes()).concat(getWalkTypes());
        return !otherTypes.includes(sportType);
      }

      return sportType === activityType;
    });
  }
}
