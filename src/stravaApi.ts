export default class StravaApi {
  apiUrl: string;

  constructor(url: string, private backendSrv: any) {
    this.apiUrl = url;
  }

  async getAuthenticatedAthlete(params?: any) {
    return await this.request('athlete', params);
  }

  async getActivities(params?: any) {
    return await this.requestWithPagination('athlete/activities', params);
  }

  async requestWithPagination(url: string, params?: any) {
    let data = [];
    let chunk = [];
    let page = 1;
    const limit = params && params.limit;
    const per_page = params && params.per_page || 200;
    while (!(chunk.length === 0 && page !== 1) && !(limit && data.length >= limit)) {
      params = {
        ...params,
        per_page,
        page,
      };
      try {
        chunk = await this.request(url, params);
      } catch (error) {
        break;
      }
      data = data.concat(chunk);
      page++;
    }
    return data;
  }

  async request(url: string, params?: any) {
    try {
      const { data } = await this.backendSrv.datasourceRequest({
        url: `${this.apiUrl}/strava/${url}`,
        method: 'GET',
        params,
      });
      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
