import React, { useEffect, useState } from 'react';
import { useAsyncFn } from 'react-use';
import { SelectableValue, QueryEditorProps, dateTime } from '@grafana/data';
import { InlineField, InlineFieldRow, InlineFormLabel, InlineSwitch, MultiSelect, Select } from '@grafana/ui';
import {
  StravaQuery,
  StravaQueryType,
  StravaActivityStat,
  StravaQueryFormat,
  StravaActivityType,
  StravaJsonData,
  StravaQueryInterval,
  StravaActivityStream,
  StravaActivityData,
  StravaSplitStat,
  StravaAthlete,
  TopAchievementStat,
  StravaActivity,
  STRAVA_SPORT_TYPES,
  getActivityTypeLabel,
} from '../types';
import StravaDatasource from '../datasource';
import { AthleteLabel } from './AthleteLabel';
import { getTemplateSrv } from '@grafana/runtime';

const ACTIVITY_DATE_FORMAT = 'YYYY-MM-DD HH:mm';

const stravaQueryTypeOptions: Array<SelectableValue<StravaQueryType>> = [
  {
    value: StravaQueryType.Activities,
    label: 'Activities',
    description: 'Athlete Activities',
  },
  {
    value: StravaQueryType.Activity,
    label: 'Activity',
    description: 'Individual activity',
  },
  {
    value: StravaQueryType.SegmentEffort,
    label: 'Segment effort',
    description: 'Activity segment efforts',
  },
];

const stravaActivityStatOptions: Array<SelectableValue<StravaActivityStat>> = [
  { value: StravaActivityStat.Distance, label: 'Distance' },
  { value: StravaActivityStat.ElapsedTime, label: 'Elapsed Time' },
  { value: StravaActivityStat.MovingTime, label: 'Moving Time' },
  { value: StravaActivityStat.ElevationGain, label: 'Elevation Gain' },
  { value: StravaActivityStat.AverageHeartRate, label: 'Average Heart Rate' },
  { value: StravaActivityStat.AveragePower, label: 'Average Power' },
  { value: StravaActivityStat.WeightedAveragePower, label: 'Weighted Average Power' },
];

const stravaActivityTypeOptions: Array<SelectableValue<StravaActivityType>> = [
  { value: null, label: 'All' },
  ...STRAVA_SPORT_TYPES.map((activityType) => ({
    value: activityType,
    label: getActivityTypeLabel(activityType),
  })),
  { value: 'Other', label: 'Other' },
];

const stravaActivityDataOptions: Array<SelectableValue<StravaActivityData>> = [
  { value: StravaActivityData.Graph, label: 'Graph' },
  { value: StravaActivityData.Splits, label: 'Splits' },
  { value: StravaActivityData.Stats, label: 'Stats' },
  { value: StravaActivityData.Segments, label: 'Segments' },
  { value: StravaActivityData.Geomap, label: 'Geomap' },
];

const stravaSegmentDataOptions: Array<SelectableValue<StravaActivityData>> = [
  { value: StravaActivityData.Graph, label: 'Graph' },
  { value: StravaActivityData.Geomap, label: 'Geomap' },
];

const stravaActivityGraphOptions: Array<SelectableValue<StravaActivityStream>> = [
  // { value: StravaActivityStream.Distance, label: 'Distance' },
  { value: StravaActivityStream.HeartRate, label: 'Heart Rate' },
  { value: StravaActivityStream.Velocity, label: 'Speed' },
  { value: StravaActivityStream.Pace, label: 'Pace' },
  { value: StravaActivityStream.WattsCalc, label: 'Est Power' },
  { value: StravaActivityStream.Watts, label: 'Watts' },
  { value: StravaActivityStream.Cadence, label: 'Cadence' },
  { value: StravaActivityStream.Altitude, label: 'Altitude' },
  { value: StravaActivityStream.GradeSmooth, label: 'Gradient' },
  // { value: StravaActivityStream.GradeAdjustedDistance, label: 'Gradient (adjusted)' },
  // { value: StravaActivityStream.Temp, label: 'Temp' },
];

const stravaActivitySplitOptions: Array<SelectableValue<StravaSplitStat>> = [
  { value: StravaSplitStat.Pace, label: 'Pace' },
  { value: StravaSplitStat.HeartRate, label: 'Heart Rate' },
  { value: StravaSplitStat.Speed, label: 'Speed' },
  { value: StravaSplitStat.ElapsedTime, label: 'Elapsed Time' },
  { value: StravaSplitStat.MovingTime, label: 'Moving Time' },
];

const FORMAT_OPTIONS: Array<SelectableValue<StravaQueryFormat>> = [
  { label: 'Time series', value: StravaQueryFormat.TimeSeries },
  { label: 'Table', value: StravaQueryFormat.Table },
  { label: 'Geomap', value: StravaQueryFormat.WorldMap },
  { label: 'Heatmap', value: StravaQueryFormat.Heatmap },
];

const INTERVAL_OPTIONS: Array<SelectableValue<StravaQueryInterval>> = [
  { label: 'Auto', value: StravaQueryInterval.Auto },
  { label: 'No', value: StravaQueryInterval.No },
  { label: 'Hour', value: StravaQueryInterval.Hour },
  { label: 'Day', value: StravaQueryInterval.Day },
  { label: 'Week', value: StravaQueryInterval.Week },
  { label: 'Month', value: StravaQueryInterval.Month },
];

const extendedStatsOptions: Array<SelectableValue<string>> = [
  { label: 'achievement_count', value: 'achievement_count' },
  { label: 'top_achievement', value: TopAchievementStat },
  { label: 'average_speed', value: 'average_speed' },
  { label: 'average_watts', value: 'average_watts' },
  { label: 'weighted_average_watts', value: 'weighted_average_watts' },
  { label: 'calories', value: 'calories' },
  { label: 'comment_count', value: 'comment_count' },
  { label: 'commute', value: 'commute' },
  { label: 'device_watts', value: 'device_watts' },
  { label: 'elev_high', value: 'elev_high' },
  { label: 'elev_low', value: 'elev_low' },
  { label: 'has_kudoed', value: 'has_kudoed' },
  { label: 'kudos_count', value: 'kudos_count' },
  { label: 'location_city', value: 'location_city' },
  { label: 'location_country', value: 'location_country' },
  { label: 'location_state', value: 'location_state' },
  { label: 'manual', value: 'manual' },
  { label: 'max_heartrate', value: 'max_heartrate' },
  { label: 'max_speed', value: 'max_speed' },
  { label: 'pr_count', value: 'pr_count' },
  { label: 'start_date', value: 'start_date' },
  { label: 'start_date_local', value: 'start_date_local' },
  { label: 'start_latitude', value: 'start_latitude' },
  { label: 'start_longitude', value: 'start_longitude' },
  { label: 'trainer', value: 'trainer' },
  { label: 'workout_type', value: 'workout_type' },
  { label: 'device_name', value: 'device_name' },
  { label: 'gear_id', value: 'gear_id' },
  { label: 'gear_name', value: 'gear_name' },
  { label: 'gear_nickname', value: 'device_nickname' },
  { label: 'gear_distance', value: 'gear_distance' },
];

const baseStatsOptions: Array<SelectableValue<string>> = [
  { label: 'start_date', value: 'start_date' },
  { label: 'name', value: 'name' },
  { label: 'distance', value: 'distance' },
  { label: 'pace', value: 'pace' },
  { label: 'moving_time', value: 'moving_time' },
  { label: 'elapsed_time', value: 'elapsed_time' },
  { label: 'average_heartrate', value: 'average_heartrate' },
  { label: 'total_elevation_gain', value: 'total_elevation_gain' },
  { label: 'kilojoules', value: 'kilojoules' },
  { label: 'type', value: 'type' },
  { label: 'id', value: 'id' },
];

const stravaStatsOptions = baseStatsOptions.concat(extendedStatsOptions);

export const defaultQuery: StravaQuery = {
  refId: '',
  queryType: StravaQueryType.Activities,
  activityType: null,
  activityStat: StravaActivityStat.Distance,
  format: StravaQueryFormat.TimeSeries,
  interval: StravaQueryInterval.Auto,
  activityData: StravaActivityData.Graph,
  activityGraph: StravaActivityStream.Pace,
  splitStat: StravaSplitStat.Speed,
  singleActivityStat: 'name',
  extendedStats: [],
  fitToTimeRange: true,
  segmentData: StravaActivityData.Graph,
  segmentGraph: StravaActivityStream.Pace,
};

export interface Props extends QueryEditorProps<StravaDatasource, StravaQuery, StravaJsonData> {}

export const QueryEditor = ({ query, datasource, onChange, onRunQuery }: Props) => {
  query = { ...defaultQuery, ...query };
  const [athlete, setAthlete] = useState<StravaAthlete | undefined>(datasource.athlete);
  const [{ loading: athleteLoading }, fetchAuthenticatedAthlete] = useAsyncFn(async () => {
    const result = await datasource.stravaApi.getAuthenticatedAthlete();
    setAthlete(result);
    return result;
  });
  const [{ value: activitiesOptions }, fetchActivitiesOptions] = useAsyncFn(async () => {
    return await getActivitiesOptions(query.activityType);
  }, [query.activityType]);
  const [{ value: segmentsOptions }, fetchSegmentsOptions] = useAsyncFn(async () => {
    const activityId = getTemplateSrv().replace(query.activityId?.toString());
    return await getSegmentsOptions(activityId);
  }, [query.activityType]);

  useEffect(() => {
    if (!datasource.athlete) {
      fetchAuthenticatedAthlete();
    }
    fetchActivitiesOptions();
    if (query.queryType === StravaQueryType.SegmentEffort) {
      fetchSegmentsOptions();
    }
  }, [datasource.athlete, query.queryType, fetchAuthenticatedAthlete, fetchActivitiesOptions, fetchSegmentsOptions]);

  const getActivitiesOptions = async (activityType: StravaActivityType): Promise<Array<SelectableValue<number>>> => {
    let activities = await datasource.stravaApi.getActivities({ limit: 100 });
    activities = datasource.filterActivities(activities, activityType);
    let options: Array<SelectableValue<number>> = activities.map((a) => ({
      value: a.id,
      label: a.name,
      description: `${dateTime(a.start_date_local).format(ACTIVITY_DATE_FORMAT)} (${a.sport_type})`,
    }));

    const variables: SelectableValue[] = getTemplateSrv()
      .getVariables()
      .map((v) => ({
        value: `$${v.name}`,
        label: `$${v.name}`,
        description: 'Variable',
      }));
    return variables.concat(options);
  };

  const getSegmentsOptions = async (activityId: string): Promise<Array<SelectableValue<number>>> => {
    let options: Array<SelectableValue<number>> = [];
    try {
      let activity: StravaActivity = await datasource.stravaApi.getActivity({
        id: activityId,
        include_all_efforts: true,
      });
      options = activity.segment_efforts?.map((a) => ({
        value: a.id,
        label: a.name,
        description: `${dateTime(a.start_date).format(ACTIVITY_DATE_FORMAT)}`,
      }));
    } catch (error) {
      console.log(error);
    }

    const variables: SelectableValue[] = getTemplateSrv()
      .getVariables()
      .map((v) => ({
        value: `$${v.name}`,
        label: `$${v.name}`,
        description: 'Variable',
      }));
    return variables.concat(options);
  };

  const getSelectedQueryType = () => {
    return stravaQueryTypeOptions.find((v) => v.value === query.queryType);
  };

  const getSelectedActivityStat = () => {
    return stravaActivityStatOptions.find((v) => v.value === query.activityStat);
  };

  const getSelectedActivityType = () => {
    return stravaActivityTypeOptions.find((v) => v.value === query.activityType);
  };

  const getSelectedActivityData = () => {
    return stravaActivityDataOptions.find((v) => v.value === query.activityData);
  };

  const getSelectedActivityGraph = () => {
    return stravaActivityGraphOptions.find((v) => v.value === query.activityGraph);
  };

  const getSelectedActivitySplit = () => {
    return stravaActivitySplitOptions.find((v) => v.value === query.splitStat);
  };

  const getSelectedSingleActivityStat = () => {
    return (
      stravaStatsOptions.find((v) => v.value === query.singleActivityStat) || {
        label: query.singleActivityStat,
        value: query.singleActivityStat,
      }
    );
  };

  const getSelectedSegmentData = () => {
    return stravaSegmentDataOptions.find((v) => v.value === query.segmentData);
  };

  const getSelectedSegmentGraph = () => {
    return stravaActivityGraphOptions.find((v) => v.value === query.segmentGraph);
  };

  const getFormatOption = () => {
    return FORMAT_OPTIONS.find((v) => v.value === query.format);
  };

  const getIntervalOption = () => {
    return INTERVAL_OPTIONS.find((v) => v.value === query.interval);
  };

  const getSelectedActivityOption = () => {
    return query.selectedActivity;
  };

  const getSelectedSegmentOption = () => {
    return query.selectedSegmentEffort;
  };

  const onPropChange = (prop: string) => {
    return (option: SelectableValue) => {
      if (option.value) {
        onChangeInternal({ ...query, [prop]: option.value });
      }
    };
  };

  const onActivityTypeChanged = async (option: SelectableValue<StravaActivityType>) => {
    if (option.value !== undefined) {
      onChangeInternal({ ...query, activityType: option.value });
      fetchActivitiesOptions();
    }
  };

  const onFitToRangeChanged = (event: React.FormEvent<HTMLInputElement>) => {
    onChangeInternal({ ...query, fitToTimeRange: !query.fitToTimeRange });
  };

  const onActivityChanged = (option: SelectableValue<number>) => {
    if (option.value !== undefined) {
      onChangeInternal({ ...query, activityId: option.value, selectedActivity: option });
    }
  };

  const onSegmentChanged = (option: SelectableValue<number>) => {
    if (option.value !== undefined) {
      onChangeInternal({ ...query, segmentEffortId: option.value, selectedSegmentEffort: option });
    }
  };

  const onExtendedStatsChanged = (options: Array<SelectableValue<string>>) => {
    if (options) {
      const values: string[] = [];
      options.forEach((option) => option.value && values.push(option.value));
      onChangeInternal({ ...query, extendedStats: values });
    }
  };

  const onChangeInternal = (query: StravaQuery) => {
    onChange(query);
    onRunQuery();
  };

  const renderActivitiesEditor = () => {
    return (
      <>
        <InlineFieldRow>
          <InlineFormLabel width={12}>&nbsp;</InlineFormLabel>
          <InlineField label="Format" labelWidth={10}>
            <Select
              isSearchable={false}
              width={20}
              options={FORMAT_OPTIONS}
              onChange={onPropChange('format')}
              value={getFormatOption()}
            />
          </InlineField>
          {query.format !== StravaQueryFormat.Heatmap && (
            <InlineField label="Stat" labelWidth={12}>
              <Select
                isSearchable={false}
                width={28}
                value={getSelectedActivityStat()}
                options={stravaActivityStatOptions}
                onChange={onPropChange('activityStat')}
              />
            </InlineField>
          )}
          {query.format === StravaQueryFormat.TimeSeries && (
            <InlineField label="Interval" labelWidth={12}>
              <Select
                isSearchable={false}
                width={16}
                options={INTERVAL_OPTIONS}
                onChange={onPropChange('interval')}
                value={getIntervalOption()}
              />
            </InlineField>
          )}
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </InlineFieldRow>
        {query.format === StravaQueryFormat.Table && (
          <InlineFieldRow>
            <InlineFormLabel width={12}>&nbsp;</InlineFormLabel>
            <InlineField label="Extended Stats" labelWidth={14}>
              <MultiSelect
                isSearchable
                isClearable
                value={query.extendedStats}
                options={extendedStatsOptions}
                onChange={onExtendedStatsChanged}
              />
            </InlineField>
            <div className="gf-form gf-form--grow">
              <div className="gf-form-label gf-form-label--grow" />
            </div>
          </InlineFieldRow>
        )}
      </>
    );
  };

  const renderActivityEditor = () => {
    return (
      <>
        <InlineFieldRow>
          <InlineFormLabel width={12}>&nbsp;</InlineFormLabel>
          <InlineField label="Activity" labelWidth={10}>
            <Select
              isSearchable={true}
              width={32}
              value={getSelectedActivityOption()}
              options={activitiesOptions}
              onChange={onActivityChanged}
            />
          </InlineField>
          <InlineField label="Data" labelWidth={10}>
            <Select
              isSearchable={false}
              width={16}
              value={getSelectedActivityData()}
              options={stravaActivityDataOptions}
              onChange={onPropChange('activityData')}
            />
          </InlineField>
          {query.activityData === StravaActivityData.Graph && (
            <InlineField>
              <Select
                isSearchable={false}
                width={16}
                value={getSelectedActivityGraph()}
                options={stravaActivityGraphOptions}
                onChange={onPropChange('activityGraph')}
              />
            </InlineField>
          )}
          {query.activityData === StravaActivityData.Splits && (
            <InlineField>
              <Select
                isSearchable={false}
                width={16}
                value={getSelectedActivitySplit()}
                options={stravaActivitySplitOptions}
                onChange={onPropChange('splitStat')}
              />
            </InlineField>
          )}
          {query.activityData === StravaActivityData.Stats && (
            <InlineField>
              <Select
                isSearchable
                allowCustomValue
                width={20}
                value={getSelectedSingleActivityStat()}
                options={stravaStatsOptions}
                onChange={onPropChange('singleActivityStat')}
              />
            </InlineField>
          )}
          <InlineField label="Fit to range" labelWidth={12}>
            <InlineSwitch value={query.fitToTimeRange || false} onChange={onFitToRangeChanged} />
          </InlineField>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </InlineFieldRow>
      </>
    );
  };

  const renderSegmentEffortEditor = () => {
    return (
      <>
        <InlineFieldRow>
          <InlineFormLabel width={12}>&nbsp;</InlineFormLabel>
          <InlineField label="Activity" labelWidth={10}>
            <Select
              isSearchable={true}
              width={32}
              value={getSelectedActivityOption()}
              options={activitiesOptions}
              onChange={onActivityChanged}
            />
          </InlineField>
          <InlineField label="Segment effort" labelWidth={14}>
            <Select
              isSearchable={true}
              width={32}
              value={getSelectedSegmentOption()}
              options={segmentsOptions}
              onChange={onSegmentChanged}
            />
          </InlineField>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineFormLabel width={12}>&nbsp;</InlineFormLabel>
          <InlineField label="Data" labelWidth={10}>
            <Select
              isSearchable={false}
              width={16}
              value={getSelectedSegmentData()}
              options={stravaSegmentDataOptions}
              onChange={onPropChange('segmentData')}
            />
          </InlineField>
          {query.segmentData === StravaActivityData.Graph && (
            <InlineField>
              <Select
                isSearchable={false}
                width={16}
                value={getSelectedSegmentGraph()}
                options={stravaActivityGraphOptions}
                onChange={onPropChange('segmentGraph')}
              />
            </InlineField>
          )}
          {query.activityData === StravaActivityData.Splits && (
            <InlineField>
              <Select
                isSearchable={false}
                width={16}
                value={getSelectedActivitySplit()}
                options={stravaActivitySplitOptions}
                onChange={onPropChange('splitStat')}
              />
            </InlineField>
          )}
          {query.activityData === StravaActivityData.Stats && (
            <InlineField>
              <Select
                isSearchable
                allowCustomValue
                width={20}
                value={getSelectedSingleActivityStat()}
                options={stravaStatsOptions}
                onChange={onPropChange('singleActivityStat')}
              />
            </InlineField>
          )}
          <InlineField label="Fit to range" labelWidth={12}>
            <InlineSwitch value={query.fitToTimeRange || false} onChange={onFitToRangeChanged} />
          </InlineField>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </InlineFieldRow>
      </>
    );
  };

  const queryType = getSelectedQueryType();

  return (
    <>
      <InlineFieldRow>
        <AthleteLabel athlete={athlete} isLoading={athleteLoading} />
        <InlineField label="Query" labelWidth={10}>
          <Select
            isSearchable={false}
            width={20}
            value={queryType}
            options={stravaQueryTypeOptions}
            onChange={onPropChange('queryType')}
          />
        </InlineField>
        <InlineField label="Activity type" labelWidth={12}>
          <Select
            isSearchable={false}
            width={16}
            value={getSelectedActivityType()}
            options={stravaActivityTypeOptions}
            onChange={onActivityTypeChanged}
          />
        </InlineField>
        <div className="gf-form gf-form--grow">
          <div className="gf-form-label gf-form-label--grow" />
        </div>
      </InlineFieldRow>
      {queryType?.value === StravaQueryType.Activities && renderActivitiesEditor()}
      {queryType?.value === StravaQueryType.Activity && renderActivityEditor()}
      {queryType?.value === StravaQueryType.SegmentEffort && renderSegmentEffortEditor()}
    </>
  );
};
