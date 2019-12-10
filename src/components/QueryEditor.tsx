import React, { PureComponent, ChangeEvent } from 'react';
import { cx, css } from 'emotion';
import { SelectableValue, QueryEditorProps } from '@grafana/data';
import { Input, FormLabel, Segment, SegmentAsync, Select } from '@grafana/ui';
import { StravaQuery, StravaQueryType, StravaActivityStat, StravaQueryFormat, StravaActivityType, StravaJsonData } from '../types';
import StravaDatasource from '../datasource';
import { AthleteLabel } from './AthleteLabel';

const stravaQueryTypeOptions: Array<SelectableValue<StravaQueryType>> = [
  { value: StravaQueryType.Activities, label: 'Activities', description: 'Athlete Activities' }
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

const FORMAT_OPTIONS: Array<SelectableValue<StravaQueryFormat>> = [
  { label: 'Time series', value: StravaQueryFormat.TimeSeries },
  { label: 'Table', value: StravaQueryFormat.Table },
  { label: 'World Map', value: StravaQueryFormat.WorldMap },
];

export const DefaultTarget: State = {
  athlete: {},
  format: StravaQueryFormat.TimeSeries,
  queryType: StravaQueryType.Activities,
  activityStat: StravaActivityStat.Distance,
  activityType: null,
  refId: '',
};

export type Props = QueryEditorProps<StravaDatasource, StravaQuery, StravaJsonData>;

interface State extends StravaQuery {
  athlete: any;
}

export class QueryEditor extends PureComponent<Props, State> {
  state: State = DefaultTarget;

  queryDefaults: Partial<StravaQuery> = {
    format: StravaQueryFormat.TimeSeries,
    queryType: StravaQueryType.Activities,
    activityStat: StravaActivityStat.Distance,
  };

  constructor(props: Props) {
    super(props);
  }

  async componentDidMount() {
    const athlete = await this.props.datasource.stravaApi.getAuthenticatedAthlete();
    this.setState({ athlete });
  }

  getSelectedQueryType = () => {
    return stravaQueryTypeOptions.find(v => v.value === this.props.query.queryType);
  }

  getSelectedActivityStat = () => {
    return stravaActivityStatOptions.find(v => v.value === this.props.query.activityStat);
  }

  getSelectedActivityType = () => {
    return stravaActivityTypeOptions.find(v => v.value === this.props.query.activityStat);
  }

  getFormatOption = () => {
    return FORMAT_OPTIONS.find(v => v.value === this.props.query.format);
  }

  onQueryTypeChanged = (option: SelectableValue<StravaQueryType>) => {
    const { query } = this.props;
    this.onChange({ ...query, queryType: option.value });
  }

  onActivityStatChanged = (option: SelectableValue<StravaActivityStat>) => {
    const { query } = this.props;
    this.onChange({ ...query, activityStat: option.value });
  }

  onActivityTypeChanged = (option: SelectableValue<StravaActivityType>) => {
    const { query } = this.props;
    this.onChange({ ...query, activityType: option.value });
  }

  onFormatChange = (option: SelectableValue<StravaQueryFormat>) => {
    const { query } = this.props;
    this.onChange({ ...query, format: option.value });
  }

  onChange(query: StravaQuery) {
    const { onChange, onRunQuery } = this.props;
    onChange(query);
    onRunQuery();
  }

  render() {
    const { query, datasource, onChange, onRunQuery, data } = this.props;
    const { athlete } = this.state;

    return (
      <>
        <div className="gf-form-inline">
          <AthleteLabel athlete={athlete} />
          <FormLabel width={5}>Type</FormLabel>
          <Select
            isSearchable={false}
            width={10}
            value={this.getSelectedQueryType()}
            options={stravaQueryTypeOptions}
            onChange={this.onQueryTypeChanged}
            className="gf-form-select"
          />
          <FormLabel width={7}>Activity</FormLabel>
          <Select
            isSearchable={false}
            width={10}
            value={this.getSelectedActivityType()}
            options={stravaActivityTypeOptions}
            onChange={this.onActivityTypeChanged}
            className="gf-form-select"
          />
          <FormLabel width={5}>Stat</FormLabel>
          <Select
            isSearchable={false}
            width={10}
            value={this.getSelectedActivityStat()}
            options={stravaActivityStatOptions}
            onChange={this.onActivityStatChanged}
            className="gf-form-select"
          />
        </div>
        <div className="gf-form-inline">
          <FormLabel>Format</FormLabel>
          <Select isSearchable={false} options={FORMAT_OPTIONS} onChange={this.onFormatChange} value={this.getFormatOption()} />
        </div>
      </>
    );
  }
}
