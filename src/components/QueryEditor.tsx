import React, { PureComponent, ChangeEvent } from 'react';
import { cx, css } from 'emotion';
import { SelectableValue, QueryEditorProps } from '@grafana/data';
import { Input, FormLabel, Segment, SegmentAsync, Select } from '@grafana/ui';
import { StravaQuery, StravaQueryTypeOption, StravaActivityStatOption, StravaQueryType, StravaActivityStat } from '../types';
import StravaDatasource from '../datasource';
import { AthleteLabel } from './AthleteLabel';

const stravaQueryTypeOptions: StravaQueryTypeOption[] = [
  { value: StravaQueryType.Activities, label: 'Activities', description: 'Athlete Activities' }
];

const stravaActivityStatOptions: StravaActivityStatOption[] = [
  { value: StravaActivityStat.Distance, label: 'Distance' },
  { value: StravaActivityStat.ElapsedTime, label: 'Elapsed Time' },
  { value: StravaActivityStat.MovingTime, label: 'Moving Time' },
  { value: StravaActivityStat.ElevationGain, label: 'Elevation Gain' },
];

export type Props = QueryEditorProps<StravaDatasource, StravaQuery>;

interface State {
  athlete: any;
}

export class QueryEditor extends PureComponent<Props, State> {
  state: State = {
    athlete: {},
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

  onQueryTypeChanged = (value: SelectableValue<StravaQueryType>) => {
    const { query } = this.props;
    this.onChange({ ...query, queryType: value.value });
  }

  onActivityStatChanged = (value: SelectableValue<StravaActivityStat>) => {
    const { query } = this.props;
    this.onChange({ ...query, activityStat: value.value });
  }

  onChange(query: StravaQuery) {
    const { onChange, onRunQuery } = this.props;
    onChange(query);
    onRunQuery();
  }

  render() {
    const { query, datasource, onChange, onRunQuery, data } = this.props;
    const { athlete } = this.state;
    console.log(athlete);

    return (
      <>
        <div className="gf-form-inline">
          <AthleteLabel athlete={athlete} />
          <FormLabel>
            Type
          </FormLabel>
          <Select
            isSearchable={false}
            width={10}
            value={this.getSelectedQueryType()}
            options={stravaQueryTypeOptions}
            onChange={this.onQueryTypeChanged}
            className="gf-form-select"
          />
          <FormLabel>
            Stat
          </FormLabel>
          <Select
            isSearchable={false}
            width={10}
            value={this.getSelectedActivityStat()}
            options={stravaActivityStatOptions}
            onChange={this.onActivityStatChanged}
            className="gf-form-select"
          />
        </div>
      </>
    );
  }
}
