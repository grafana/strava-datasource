import React, { PureComponent } from 'react';
import { SelectableValue, QueryEditorProps } from '@grafana/data';
import { AsyncSelect, InlineFormLabel, InlineSwitch, Select } from '@grafana/ui';
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

const stravaActivityDataOptions: Array<SelectableValue<StravaActivityData>> = [
  { value: StravaActivityData.Graph, label: 'Graph' },
  { value: StravaActivityData.Splits, label: 'Splits' },
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
  { value: StravaSplitStat.HeartRate, label: 'Heart Rate' },
  { value: StravaSplitStat.Speed, label: 'Speed' },
  { value: StravaSplitStat.ElapsedTime, label: 'Elapsed Time' },
  { value: StravaSplitStat.MovingTime, label: 'Moving Time' },
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
  activityData: StravaActivityData.Graph,
  activityGraph: StravaActivityStream.HeartRate,
};

export interface Props extends QueryEditorProps<StravaDatasource, StravaQuery, StravaJsonData> {}

interface State extends StravaQuery {
  athlete: any;
  selectedActivity?: SelectableValue<number>;
}

export class QueryEditor extends PureComponent<Props, State> {
  state: State = DefaultTarget;

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

  getSelectedActivityData = () => {
    return stravaActivityDataOptions.find(v => v.value === this.props.query.activityData);
  };

  getSelectedActivityGraph = () => {
    return stravaActivityGraphOptions.find(v => v.value === this.props.query.activityGraph);
  };

  getSelectedActivitySplit = () => {
    return stravaActivitySplitOptions.find(v => v.value === this.props.query.splitStat);
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

  onActivityDataChanged = (option: SelectableValue<StravaActivityData>) => {
    const { query } = this.props;
    if (option.value) {
      this.onChange({ ...query, activityData: option.value });
    }
  };

  onActivityGraphChanged = (option: SelectableValue<StravaActivityStream>) => {
    const { query } = this.props;
    if (option.value) {
      this.onChange({ ...query, activityGraph: option.value });
    }
  };

  onActivitySplitChanged = (option: SelectableValue<StravaSplitStat>) => {
    const { query } = this.props;
    if (option.value) {
      this.onChange({ ...query, splitStat: option.value });
    }
  };

  onActivityTypeChanged = (option: SelectableValue<StravaActivityType>) => {
    const { query } = this.props;
    if (option.value !== undefined) {
      this.onChange({ ...query, activityType: option.value });
    }
  };

  onFitToRangeChanged = (event: React.FormEvent<HTMLInputElement>) => {
    const { query } = this.props;
    this.onChange({ ...query, fitToTimeRange: !query.fitToTimeRange });
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
          <InlineFormLabel width={5}>Activity type</InlineFormLabel>
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

  renderActivityEditor() {
    const { query } = this.props;
    return (
      <>
        <div className="gf-form-inline">
          <InlineFormLabel width={12}>&nbsp;</InlineFormLabel>
          <InlineFormLabel width={5}>Activity</InlineFormLabel>
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
          <InlineFormLabel width={5}>Data</InlineFormLabel>
          <Select
            isSearchable={false}
            width={16}
            value={this.getSelectedActivityData()}
            options={stravaActivityDataOptions}
            onChange={this.onActivityDataChanged}
          />
          {query.activityData === StravaActivityData.Graph &&
            <>
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
          {query.activityData === StravaActivityData.Splits &&
            <>
              <InlineFormLabel width={5}>Split</InlineFormLabel>
              <Select
                isSearchable={false}
                width={16}
                value={this.getSelectedActivitySplit()}
                options={stravaActivitySplitOptions}
                onChange={this.onActivitySplitChanged}
              />
            </>
          }
          <InlineFormLabel width={5}>Fit to range</InlineFormLabel>
          <InlineSwitch css=''
            value={query.fitToTimeRange || false}
            onChange={this.onFitToRangeChanged}
            >
          </InlineSwitch>
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
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>
        {queryType?.value === StravaQueryType.Activities &&
          this.renderActivitiesEditor()
        }
        {queryType?.value === StravaQueryType.Activity &&
          this.renderActivityEditor()
        }
      </>
    );
  }
}
