import {
  DataQueryRequest,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  MutableDataFrame,
  TimeSeries
} from "@grafana/data";
import StravaApi from "./stravaApi";

import {
  StravaActivityStat,
  StravaJsonData,
  StravaQuery,
  StravaQueryType
} from "./types";
import moment from "moment";

export default class StravaDatasource extends DataSourceApi<
  StravaQuery,
  StravaJsonData
> {
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
    this.type = "strava";
    this.apiUrl = instanceSettings.url;
    this.stravaApi = new StravaApi(instanceSettings.url, backendSrv);
  }

  async query(options: DataQueryRequest<StravaQuery>) {
    const { range } = options;
    const from = range.from.valueOf();
    const to = range.to.valueOf();

    const data = options.targets.map(target => {
      this.stravaApi.getActivities().then(response => {
        return new MutableDataFrame({
          refId: target.refId,
          fields: [
            { name: "Time", values: [from, to], type: FieldType.time },
            {
              name: "Value",
              values: [response.elapsed_time, response.elapsed_time],
              type: FieldType.number
            }
          ]
        });
      });
    });

    return { data };
  }

  convertToTimeSeries(data: any): TimeSeries {
    return {
      target: "activities",
      datapoints: data.map(entry => {
        return [entry.elapsed_time, moment(entry.start_date).valueOf()];
      })
    };
  }

  testDatasource() {
    return this.request("athlete/activities")
      .then(response => {
        console.log(response);
        return { status: "success", message: "Data source is working" };
      })
      .catch(error => {
        console.log(error);
        return { status: "error", message: "Cannot connect to Strava API" };
      });
  }

  async request(url: string, options?: any) {
    try {
      const { data } = await this.backendSrv.datasourceRequest({
        url: `${this.apiUrl}/strava/${url}`,
        // url: `${this.apiUrl}/api/${url}`,
        method: "GET"
      });
      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
