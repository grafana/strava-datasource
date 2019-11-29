import React from 'react';
import {
  dateMath,
  ScopedVars,
  toDataFrame,
  TimeRange,
  DataSourceApi,
  DataQueryRequest,
  DataSourceInstanceSettings,
} from '@grafana/data';
import StravaApi from './stravaApi';

import { StravaQuery, StravaJsonData } from "types";

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

    const data = await this.request('clubs/567311/members');
    return this.handleResponse(data);
  }

  testDatasource() {
    return this.request('clubs/567311/members').then(response => {
      console.log(response);
      return { status: 'success', message: 'Data source is working' };
    }).catch(error => {
      console.log(error);
      return { status: 'error', message: 'Cannot connect to Strava API' };
    });
  }

  handleResponse(data) {
    console.log(data);
  }

  async request(url: string, options?: any) {
    try {
      const { data } = await this.backendSrv.datasourceRequest({
        // url: `${this.apiUrl}/strava/${url}`,
        url: `${this.apiUrl}/api/${url}`,
        method: 'GET',
      });
      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
