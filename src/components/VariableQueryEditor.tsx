import React, { PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { VariableQueryTypes, StravaActivityType, VariableQuery, STRAVA_SPORT_TYPES, getActivityTypeLabel } from '../types';
import { InlineField, InlineFieldRow, InlineFormLabel, Input, Select } from '@grafana/ui';
import { DEFAULT_LIMIT } from '../datasource';

const stravaActivityTypeOptions: Array<SelectableValue<StravaActivityType>> = [
  { value: '', label: 'All' },
  ...STRAVA_SPORT_TYPES.map((activityType) => ({
    value: activityType,
    label: getActivityTypeLabel(activityType),
  })),
  { value: 'Other', label: 'Other' },
];

export interface VariableQueryProps {
  query: VariableQuery;
  onChange: (query: VariableQuery, definition: string) => void;
  datasource: any;
  templateSrv: any;
}

interface State {
  limit: number;
}

export class StravaVariableQueryEditor extends PureComponent<VariableQueryProps, State> {
  constructor(props: VariableQueryProps) {
    super(props);
    const { query } = this.props;
    this.state = {
      limit: query.limit || DEFAULT_LIMIT,
    };
  }

  queryTypes: Array<SelectableValue<VariableQueryTypes>> = [
    { value: VariableQueryTypes.Activity, label: 'Activity' },
    { value: VariableQueryTypes.SegmentEffort, label: 'Segment effort' },
  ];

  onQueryTypeChange = (selectedItem: SelectableValue<VariableQueryTypes>) => {
    const queryType = selectedItem.value || VariableQueryTypes.Activity;

    const queryModel: VariableQuery = { ...this.props.query, queryType };
    this.props.onChange(queryModel, `Strava - ${queryType}`);
  };

  onActivityTypeChange = (selectedItem: SelectableValue<StravaActivityType>) => {
    const activityType = selectedItem.value || '';

    const queryModel: VariableQuery = { ...this.props.query, activityType };
    this.props.onChange(queryModel, `Strava - ${this.props.query.queryType}`);
  };

  onLimitStateChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const limit = Number(e.currentTarget.value || '');
    this.setState({ limit });
  };

  onLimitChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const limit = Number(e.currentTarget.value || '');
    const queryModel: VariableQuery = { ...this.props.query, limit };
    this.props.onChange(queryModel, `Strava - ${this.props.query.queryType}`);
  };

  onActivityIdChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const activityId = e.currentTarget.value || '';
    const queryModel: VariableQuery = { ...this.props.query, activityId };
    this.props.onChange(queryModel, `Strava - ${this.props.query.queryType}`);
  };

  render() {
    const { query } = this.props;
    const { limit } = this.state;

    return (
      <>
        <div className="gf-form max-width-21">
          <InlineFormLabel width={10}>Query Type</InlineFormLabel>
          <Select width={20} value={query.queryType} options={this.queryTypes} onChange={this.onQueryTypeChange} />
        </div>
        <div className="gf-form-inline">
          {query.queryType === VariableQueryTypes.Activity && (
            <InlineFieldRow>
              <InlineField label="Activity Type" labelWidth={20}>
                <Select
                  width={16}
                  value={query.activityType}
                  onChange={this.onActivityTypeChange}
                  options={stravaActivityTypeOptions}
                />
              </InlineField>
              <InlineField label="Limit" labelWidth={10} tooltip="API query limit. Set to 0 for no limit.">
                <Input
                  type="number"
                  value={limit}
                  onChange={this.onLimitStateChange}
                  onBlur={this.onLimitChange}
                  width={12}
                />
              </InlineField>
            </InlineFieldRow>
          )}
          {query.queryType === VariableQueryTypes.SegmentEffort && (
            <InlineFieldRow>
              <InlineField label="Activity" labelWidth={20} tooltip="Activity id">
                <Input
                  value={query.activityId}
                  onChange={this.onActivityIdChange}
                  onBlur={this.onActivityIdChange}
                  width={30}
                />
              </InlineField>
            </InlineFieldRow>
          )}
        </div>
      </>
    );
  }
}
