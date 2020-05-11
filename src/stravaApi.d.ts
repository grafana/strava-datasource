export default class StravaApi {
    datasourceId: number;
    apiUrl: string;
    promises: any;
    constructor(datasourceId: number);
    getAuthenticatedAthlete(params?: any): Promise<any>;
    getActivities(params?: any): Promise<any[]>;
    requestWithPagination(url: string, params?: any): Promise<any[]>;
    exchangeToken(authCode: any): Promise<any>;
    request(url: string, params?: any): Promise<any>;
    _request(url: string, params?: any): Promise<any>;
    tsdbRequest(endpoint: string, params?: any): Promise<any>;
    _tsdbRequest(endpoint: string, params?: any): Promise<any>;
    tsdbAuthRequest(params?: any): Promise<any>;
    handleTsdbResponse(response: any, queryType?: string): any;
    proxyfy(func: any, funcName: any, funcScope: any): (...args: any[]) => any;
}
