export default class StravaApi {
  apiUrl: string;

  constructor(url: string, private backendSrv: any) {
    this.apiUrl = url;
  }

  async getAuthenticatedAthlete() {
    return await this.request('athlete');
  }

  async getActivities() {
    return await this.request('athlete/activities');
  }

  async request(url: string, options?: any) {
    try {
      const { data } = await this.backendSrv.datasourceRequest({
        url: `${this.apiUrl}/strava/${url}`,
        method: 'GET',
      });
      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
