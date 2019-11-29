export default class StravaApi {
  apiUrl: string;

  constructor(url: string, private backendSrv: any) {
    this.apiUrl = url;
  }

  async getAuthenticatedAthlete() {
    const data = await this.request('athlete');
    console.log(data);
    return data;
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
