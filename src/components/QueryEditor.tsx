import React, { PureComponent } from "react";
import { SelectableValue, QueryEditorProps } from "@grafana/data";
import { FormLabel, Select } from "@grafana/ui";
import {
  StravaActivityStat,
  StravaActivityType,
  StravaJsonData,
  StravaQuery,
  StravaQueryFormat,
  StravaQueryInterval,
  StravaQueryType,
} from "../types";
import StravaDatasource from "../datasource";
import { AthleteLabel } from "./AthleteLabel";

const stravaQueryTypeOptions: Array<SelectableValue<StravaQueryType>> = [
  {
    value: StravaQueryType.Activities,
    label: "Activities",
    description: "Athlete Activities",
  },
];

const stravaActivityStatOptions: Array<SelectableValue<StravaActivityStat>> = [
  { value: StravaActivityStat.Distance, label: "Distance" },
  { value: StravaActivityStat.ElapsedTime, label: "Elapsed Time" },
  { value: StravaActivityStat.MovingTime, label: "Moving Time" },
  { value: StravaActivityStat.ElevationGain, label: "Elevation Gain" },
  { value: StravaActivityStat.AveragePower, label: "Average Power" },
];

const stravaActivityTypeOptions: Array<SelectableValue<StravaActivityType>> = [
  { value: null, label: "All" },
  { value: "Run", label: "Run" },
  { value: "Ride", label: "Ride" },
  { value: "Other", label: "Other" },
];

const FORMAT_OPTIONS: Array<SelectableValue<StravaQueryFormat>> = [
  { label: "Time series", value: StravaQueryFormat.TimeSeries },
  { label: "Table", value: StravaQueryFormat.Table },
  { label: "World Map", value: StravaQueryFormat.WorldMap },
];

const INTERVAL_OPTIONS: Array<SelectableValue<StravaQueryInterval>> = [
  { label: "Auto", value: StravaQueryInterval.Auto },
  { label: "No", value: StravaQueryInterval.No },
  { label: "Hour", value: StravaQueryInterval.Hour },
  { label: "Day", value: StravaQueryInterval.Day },
  { label: "Week", value: StravaQueryInterval.Week },
  { label: "Month", value: StravaQueryInterval.Month },
];

export const DefaultTarget: State = {
  refId: "",
  athlete: {},
  queryType: StravaQueryType.Activities,
  activityType: null,
  activityStat: StravaActivityStat.Distance,
  format: StravaQueryFormat.TimeSeries,
  interval: StravaQueryInterval.Auto,
};

export interface Props
  extends QueryEditorProps<StravaDatasource, StravaQuery, StravaJsonData> {}

interface State extends StravaQuery {
  athlete: any;
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
    return stravaQueryTypeOptions.find(
      (v) => v.value === this.props.query.queryType
    );
  };

  getSelectedActivityStat = () => {
    return stravaActivityStatOptions.find(
      (v) => v.value === this.props.query.activityStat
    );
  };

  getSelectedActivityType = () => {
    return stravaActivityTypeOptions.find(
      (v) => v.value === this.props.query.activityType
    );
  };

  getFormatOption = () => {
    return FORMAT_OPTIONS.find((v) => v.value === this.props.query.format);
  };

  getIntervalOption = () => {
    return INTERVAL_OPTIONS.find((v) => v.value === this.props.query.interval);
  };

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

  onActivityTypeChanged = (option: SelectableValue<StravaActivityType>) => {
    const { query } = this.props;
    if (option.value) {
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

  onChange(query: StravaQuery) {
    const { onChange, onRunQuery } = this.props;
    onChange(query);
    onRunQuery();
  }

  render() {
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
          )}
        </div>
        <div className="gf-form-inline">
          <FormLabel>Format</FormLabel>
          <Select
            isSearchable={false}
            options={FORMAT_OPTIONS}
            onChange={this.onFormatChange}
            value={this.getFormatOption()}
          />
          <FormLabel>Interval</FormLabel>
          <Select
            isSearchable={false}
            options={INTERVAL_OPTIONS}
            onChange={this.onIntervalChange}
            value={this.getIntervalOption()}
          />
        </div>
      </>
    );
  }
}
