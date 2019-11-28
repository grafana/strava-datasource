import React, { PureComponent, ChangeEvent } from 'react';
import { SelectableValue, QueryEditorProps } from '@grafana/data';
import { Input, FormLabel, Segment, SegmentAsync, ValidationEvents, EventsWithValidation, Switch } from '@grafana/ui';
import { StravaQuery } from '../types';
import StravaDatasource from '../datasource';

export type Props = QueryEditorProps<StravaDatasource, StravaQuery>;

interface State {
}

export class QueryEditor extends PureComponent<Props, State> {
  state: State = {};

  render() {
    const { query, datasource, onChange, onRunQuery, data } = this.props;

    return (
      <>
        <div className="gf-form-inline">
          <div className="gf-form">
            <FormLabel width={8} className="query-keyword" tooltip="Minimum interval between points in seconds">
              Period
            </FormLabel>
            <Input
              className="gf-form-input width-8"
              value={query.period || ''}
              placeholder="auto"
              onBlur={onRunQuery}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...query, period: event.target.value })}
            />
          </div>
        </div>
      </>
    );
  }
}
