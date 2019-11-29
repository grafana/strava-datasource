import React, { PureComponent, ChangeEvent } from 'react';
import { cx, css } from 'emotion';
import { SelectableValue, QueryEditorProps } from '@grafana/data';
import { Input, FormLabel, Segment, SegmentAsync } from '@grafana/ui';
import { StravaQuery } from '../types';
import StravaDatasource from '../datasource';
import { AthleteLabel } from './AthleteLabel';

export type Props = QueryEditorProps<StravaDatasource, StravaQuery>;

interface State {
  athlete: any;
}

export class QueryEditor extends PureComponent<Props, State> {
  state: State = {
    athlete: {},
  };

  async componentDidMount() {
    const athlete = await this.props.datasource.stravaApi.getAuthenticatedAthlete();
    this.setState({ athlete });
  }

  render() {
    const { query, datasource, onChange, onRunQuery, data } = this.props;
    const { athlete } = this.state;
    console.log(athlete);

    return (
      <>
        <div className="gf-form-inline">
          <AthleteLabel athlete={athlete} />
            {/* <Input
              className="gf-form-input width-8"
              value={query.period || ''}
              placeholder="auto"
              onBlur={onRunQuery}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...query, period: event.target.value })}
            /> */}
        </div>
      </>
    );
  }
}
