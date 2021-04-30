import React, { PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { VariableQueryTypes, StravaActivityType, VariableQuery } from '../types';
import { InlineFormLabel, Select } from '@grafana/ui';

const stravaActivityTypeOptions: Array<SelectableValue<StravaActivityType>> = [
  { value: '', label: 'All' },
  { value: 'Run', label: 'Run' },
  { value: 'Ride', label: 'Ride' },
  { value: 'Other', label: 'Other' },
];

export interface VariableQueryProps {
  query: VariableQuery;
  onChange: (query: VariableQuery, definition: string) => void;
  datasource: any;
  templateSrv: any;
}

export class StravaVariableQueryEditor extends PureComponent<VariableQueryProps> {
  queryTypes: Array<SelectableValue<VariableQueryTypes>> = [{ value: VariableQueryTypes.Activity, label: 'Activity' }];

  onQueryTypeChange = (selectedItem: SelectableValue<VariableQueryTypes>) => {
    const queryType = selectedItem.value || VariableQueryTypes.Activity;

    const queryModel: VariableQuery = { ...this.props.query, queryType };
    this.props.onChange(queryModel, `Strava - ${queryType}`);
  };

  onActivityTypeChange = (selectedItem: SelectableValue<StravaActivityType>) => {
    const activityType = selectedItem.value || '';

    const queryModel: VariableQuery = { ...this.props.query, activityType };
    console.log(queryModel);
    this.props.onChange(queryModel, `Strava - ${this.props.query.queryType}`);
  };

  render() {
    const { query } = this.props;

    return (
      <>
        <div className="gf-form max-width-21">
          <InlineFormLabel width={10}>Query Type</InlineFormLabel>
          <Select width={16} value={query.queryType} options={this.queryTypes} onChange={this.onQueryTypeChange} />
        </div>
        <div className="gf-form-inline">
          {query.queryType === VariableQueryTypes.Activity && (
            <div className="gf-form max-width-30">
              <InlineFormLabel width={10}>Activity Type</InlineFormLabel>
              <Select
                width={16}
                value={query.activityType}
                onChange={this.onActivityTypeChange}
                options={stravaActivityTypeOptions}
              />
            </div>
          )}
        </div>
      </>
    );
  }
}
