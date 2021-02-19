import React, { PureComponent } from 'react';
import { SelectableValue, QueryEditorProps } from '@grafana/data';
import { AsyncSelect, InlineFormLabel, Select } from '@grafana/ui';
import {
  StravaQuery,
  StravaQueryType,
  StravaActivityStat,
  StravaQueryFormat,
  StravaActivityType,
  StravaJsonData,
  StravaQueryInterval,
  StravaActivityStream,
} from '../types';
import StravaDatasource from '../datasource';
import { AthleteLabel } from './AthleteLabel';

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
];

const stravaActivityStatOptions: Array<SelectableValue<StravaActivityStat>> = [
  { value: StravaActivityStat.Distance, label: 'Distance' },
  { value: StravaActivityStat.ElapsedTime, label: 'Elapsed Time' },
  { value: StravaActivityStat.MovingTime, label: 'Moving Time' },
  { value: StravaActivityStat.ElevationGain, label: 'Elevation Gain' },
  { value: StravaActivityStat.AveragePower, label: 'Average Power' },
];

const stravaActivityTypeOptions: Array<SelectableValue<StravaActivityType>> = [
  { value: null, label: 'All' },
  { value: 'Run', label: 'Run' },
  { value: 'Ride', label: 'Ride' },
  { value: 'Other', label: 'Other' },
];

const stravaActivityGraphOptions: Array<SelectableValue<StravaActivityStream>> = [
  { value: StravaActivityStream.Distance, label: 'Distance' },
  { value: StravaActivityStream.HeartRate, label: 'Heart rate' },
  { value: StravaActivityStream.Velocity, label: 'Velocity' },
  { value: StravaActivityStream.Cadence, label: 'Cadence' },
  { value: StravaActivityStream.Altitude, label: 'Altitude' },
  { value: StravaActivityStream.Temp, label: 'Temp' },
];

const FORMAT_OPTIONS: Array<SelectableValue<StravaQueryFormat>> = [
  { label: 'Time series', value: StravaQueryFormat.TimeSeries },
  { label: 'Table', value: StravaQueryFormat.Table },
  { label: 'World Map', value: StravaQueryFormat.WorldMap },
];

const INTERVAL_OPTIONS: Array<SelectableValue<StravaQueryInterval>> = [
  { label: 'Auto', value: StravaQueryInterval.Auto },
  { label: 'No', value: StravaQueryInterval.No },
  { label: 'Hour', value: StravaQueryInterval.Hour },
  { label: 'Day', value: StravaQueryInterval.Day },
  { label: 'Week', value: StravaQueryInterval.Week },
  { label: 'Month', value: StravaQueryInterval.Month },
];

export const DefaultTarget: State = {
  refId: '',
  athlete: {},
  queryType: StravaQueryType.Activities,
  activityType: null,
  activityStat: StravaActivityStat.Distance,
  format: StravaQueryFormat.TimeSeries,
  interval: StravaQueryInterval.Auto,
};

export interface Props extends QueryEditorProps<StravaDatasource, StravaQuery, StravaJsonData> {}

interface State extends StravaQuery {
  athlete: any;
  selectedActivity?: SelectableValue<number>;
}

export class QueryEditor extends PureComponent<Props, State> {
  state: State = DefaultTarget;

  queryDefaults: Partial<StravaQuery> = {
    format: StravaQueryFormat.TimeSeries,
    queryType: StravaQueryType.Activities,
    activityType: null,
    activityStat: StravaActivityStat.Distance,
  };

  async componentDidMount() {
    const athlete = await this.props.datasource.stravaApi.getAuthenticatedAthlete();
    this.setState({ athlete });
  }

  getSelectedQueryType = () => {
    return stravaQueryTypeOptions.find(v => v.value === this.props.query.queryType);
  };

  getSelectedActivityStat = () => {
    return stravaActivityStatOptions.find(v => v.value === this.props.query.activityStat);
  };

  getSelectedActivityType = () => {
    return stravaActivityTypeOptions.find(v => v.value === this.props.query.activityType);
  };

  getSelectedActivityGraph = () => {
    return stravaActivityGraphOptions.find(v => v.value === this.props.query.activityGraph);
  };

  getFormatOption = () => {
    return FORMAT_OPTIONS.find(v => v.value === this.props.query.format);
  };

  getIntervalOption = () => {
    return INTERVAL_OPTIONS.find(v => v.value === this.props.query.interval);
  };

  getSelectedActivityOption = () => {
    return this.props.query.selectedActivity;
  };

  getActivitiesOptions = async (query: string): Promise<Array<SelectableValue<number>>> => {
    let activities = await this.props.datasource.stravaApi.getActivities({ limit: 100 });
    activities = activities.filter(a => a.name.includes(query));
    const options:Array<SelectableValue<number>> = activities.map(a => ({
      value: a.id,
      label: a.name,
      description: a.start_date_local,
    }));
    return options;
  }

  onQueryTypeChanged = (option: SelectableValue<StravaQueryType>) => {
    const { query } = this.props;
    if (option.value) {
      this.onChange({ ...query, queryType: option.value });
    }
  };

  onActivityStatChanged = (option: SelectableValue<StravaActivityStat>) => {
    const { query } = this.props;
    if (option.value) {
      this.onChange({ ...query, activityStat: option.value });
    }
  };

  onActivityGraphChanged = (option: SelectableValue<StravaActivityStream>) => {
    const { query } = this.props;
    if (option.value) {
      this.onChange({ ...query, activityGraph: option.value });
    }
  };

  onActivityTypeChanged = (option: SelectableValue<StravaActivityType>) => {
    const { query } = this.props;
    if (option.value !== undefined) {
      this.onChange({ ...query, activityType: option.value });
    }
  };

  onFormatChange = (option: SelectableValue<StravaQueryFormat>) => {
    const { query } = this.props;
    if (option.value) {
      this.onChange({ ...query, format: option.value });
    }
  };

  onIntervalChange = (option: SelectableValue<StravaQueryInterval>) => {
    const { query } = this.props;
    if (option.value) {
      this.onChange({ ...query, interval: option.value });
    }
  };

  onActivityChanged = (option: SelectableValue<number>) => {
    const { query } = this.props;
    if (option.value !== undefined) {
      this.onChange({ ...query, activityId: option.value, selectedActivity: option });
    }
  };

  onChange(query: StravaQuery) {
    const { onChange, onRunQuery } = this.props;
    onChange(query);
    onRunQuery();
  }

  renderActivitiesEditor() {
    return (
      <>
        <div className="gf-form-inline">
          <InlineFormLabel width={12}>&nbsp;</InlineFormLabel>
          <InlineFormLabel width={5}>Activity</InlineFormLabel>
          <Select
            isSearchable={false}
            width={16}
            value={this.getSelectedActivityType()}
            options={stravaActivityTypeOptions}
            onChange={this.onActivityTypeChanged}
          />
          <InlineFormLabel width={5}>Stat</InlineFormLabel>
          <Select
            isSearchable={false}
            width={16}
            value={this.getSelectedActivityStat()}
            options={stravaActivityStatOptions}
            onChange={this.onActivityStatChanged}
          />
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>
        <div className="gf-form-inline">
          <InlineFormLabel width={12}>&nbsp;</InlineFormLabel>
          <InlineFormLabel width={12}>Format</InlineFormLabel>
          <Select
            isSearchable={false}
            width={27}
            options={FORMAT_OPTIONS}
            onChange={this.onFormatChange}
            value={this.getFormatOption()}
          />
          <InlineFormLabel width={5}>Interval</InlineFormLabel>
          <Select
            isSearchable={false}
            width={16}
            options={INTERVAL_OPTIONS}
            onChange={this.onIntervalChange}
            value={this.getIntervalOption()}
          />
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>
      </>
    );
  }

  render() {
    const { athlete } = this.state;
    const queryType = this.getSelectedQueryType();

    return (
      <>
        <div className="gf-form-inline">
          <AthleteLabel athlete={athlete} />
          <InlineFormLabel width={5}>Type</InlineFormLabel>
          <Select
            isSearchable={false}
            width={16}
            value={this.getSelectedQueryType()}
            options={stravaQueryTypeOptions}
            onChange={this.onQueryTypeChanged}
          />
          <InlineFormLabel width={5}>Activity</InlineFormLabel>
          {queryType?.value === StravaQueryType.Activities &&
            <Select
              isSearchable={false}
              width={16}
              value={this.getSelectedActivityType()}
              options={stravaActivityTypeOptions}
              onChange={this.onActivityTypeChanged}
            />
          }
          {queryType?.value === StravaQueryType.Activity &&
            <>
              <AsyncSelect
                isSearchable={true}
                cacheOptions={true}
                showAllSelectedWhenOpen={true}
                width={20}
                value={this.getSelectedActivityOption()}
                defaultOptions={true}
                loadOptions={this.getActivitiesOptions}
                onChange={this.onActivityChanged}
              />
              <InlineFormLabel width={5}>Graph</InlineFormLabel>
              <Select
                isSearchable={false}
                width={16}
                value={this.getSelectedActivityGraph()}
                options={stravaActivityGraphOptions}
                onChange={this.onActivityGraphChanged}
              />
            </>
          }
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>
        {queryType?.value === StravaQueryType.Activities &&
          this.renderActivitiesEditor()
        }
      </>
    );
  }
}
