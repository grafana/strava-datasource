import React from 'react';
import {
  dateMath,
  ScopedVars,
  toDataFrame,
  TimeRange,
  DataSourceApi,
  DataQueryRequest,
  DataSourceInstanceSettings,
  TableData,
} from '@grafana/data';
import StravaApi from './stravaApi';

import { StravaQuery, StravaJsonData, StravaActivityStat } from './types';

export default class StravaDatasource extends DataSourceApi<StravaQuery, StravaJsonData> {
  type: any;
  apiUrl: string;
  datasourceName: string;
  stravaApi: StravaApi;

  /** @ngInject */
  constructor(
    instanceSettings: DataSourceInstanceSettings<StravaJsonData>,
    private backendSrv: any,
    private templateSrv: any,
    private timeSrv: any
  ) {
    super(instanceSettings);
    this.type = 'strava';
    this.apiUrl = instanceSettings.url;
    this.stravaApi = new StravaApi(instanceSettings.url, backendSrv);
  }

  async query(options: DataQueryRequest<StravaQuery>) {
    console.log(options);

    const data = await this.stravaApi.requestWithPagination('athlete/activities', { limit: 10, per_page: 10 });
    const tableData = this.transformActivitiesToWorldMapResponse(data, options.targets[0]);
    console.log(tableData);
    return {
      state: 'Done',
      data: [tableData],
    };
  }

  testDatasource() {
    return this.request('athlete/activities').then(response => {
      console.log(response);
      return { status: 'success', message: 'Data source is working' };
    }).catch(error => {
      console.log(error);
      return { status: 'error', message: 'Cannot connect to Strava API' };
    });
  }

  getActivities() {
    return this.request('athlete/activities').then(response => {
      console.log(response);
    }).catch(error => {
      console.log(error);
    });
  }

  handleResponse(data) {
    console.log(data);
  }

  transformActivitiesToWorldMapResponse(data: any[], target: StravaQuery) {
    const unit =
      target.activityStat === StravaActivityStat.Distance ||
      target.activityStat === StravaActivityStat.ElevationGain ? 'lengthm' : 's';
    const table: TableData = {
      type: 'table',
      columns: [
        { text: 'value', unit },
        { text: 'name' },
        { text: 'latitude' },
        { text: 'longitude' },
      ],
      rows: []
    };

    for (const activity of data) {
      const row = [
        activity[target.activityStat],
        activity.name,
        activity.start_latitude,
        activity.start_longitude,
      ];
      if (activity.start_latitude && activity.start_longitude) {
        table.rows.push(row);
      }
    }
    return table;
  }

  async request(url: string, options?: any) {
    try {
      const { data } = await this.backendSrv.datasourceRequest({
        url: `${this.apiUrl}/strava/${url}`,
        // url: `${this.apiUrl}/api/${url}`,
        method: 'GET',
      });
      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
