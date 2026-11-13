import { getBackendSrv } from '@grafana/runtime';
import StravaApi from './stravaApi';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn(),
}));

describe('StravaApi', () => {
  const backend = {
    get: jest.fn(),
    post: jest.fn(),
  };
  let api: StravaApi;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(getBackendSrv).mockReturnValue(backend as unknown as ReturnType<typeof getBackendSrv>);
    api = new StravaApi('strava-test-uid');
  });

  it('returns the athlete from the response body without an HTTP response envelope', async () => {
    const athlete = { id: 123, firstname: 'Test' };
    backend.post.mockResolvedValue({ result: athlete });

    await expect(api.getAuthenticatedAthlete()).resolves.toEqual(athlete);
  });

  it('returns all activity pages from response bodies', async () => {
    backend.post
      .mockResolvedValueOnce({ result: [{ id: 1 }] })
      .mockResolvedValueOnce({ result: [{ id: 2 }] })
      .mockResolvedValueOnce({ result: [] });

    await expect(api.getActivities({ per_page: 1 })).resolves.toEqual([{ id: 1 }, { id: 2 }]);

    expect(backend.post).toHaveBeenCalledTimes(3);
    expect(backend.post).toHaveBeenNthCalledWith(2, '/api/datasources/uid/strava-test-uid/resources/strava-api', {
      endpoint: 'athlete/activities',
      params: { per_page: 1, page: 2 },
    });
  });

  it('exchanges an auth code through the UID route and returns the result', async () => {
    const result = { message: 'Authorization code successfully exchanged for refresh token' };
    backend.post.mockResolvedValue({ result });

    await expect(api.exchangeToken('test-auth-code')).resolves.toEqual(result);
    expect(backend.post).toHaveBeenCalledWith('/api/datasources/uid/strava-test-uid/resources/auth', {
      authCode: 'test-auth-code',
    });
  });

  it('returns the response body from a direct GET request', async () => {
    const athlete = { id: 123 };
    backend.get.mockResolvedValue(athlete);

    await expect(api.request('athlete', { page: 1 })).resolves.toEqual(athlete);
    expect(backend.get).toHaveBeenCalledWith('/strava/athlete', { page: 1 });
  });

  it.each([
    ['resetAccessToken', 'reset-access-token'],
    ['resetCache', 'reset-cache'],
  ] as const)('uses the UID resource route for %s', async (method, resource) => {
    backend.get.mockResolvedValue({ message: 'Reset complete' });

    await api[method]();

    expect(backend.get).toHaveBeenCalledWith(`/api/datasources/uid/strava-test-uid/resources/${resource}`);
  });

  it.each(['HTTP', 'Strava'])('propagates %s errors instead of returning empty data', async (source) => {
    const error = new Error('Request failed');
    if (source === 'HTTP') {
      backend.post.mockRejectedValue(error);
    } else {
      backend.post.mockResolvedValue({ result: { error: error.message } });
    }
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(api.getAuthenticatedAthlete()).rejects.toThrow('Request failed');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('sends the endpoint and parameters as the POST body to the UID resource route', async () => {
    backend.post.mockResolvedValue({ result: { id: 123 } });

    await api.getActivity({ id: 123, include_all_efforts: true });

    expect(backend.post).toHaveBeenCalledTimes(1);
    expect(backend.post).toHaveBeenCalledWith('/api/datasources/uid/strava-test-uid/resources/strava-api', {
      endpoint: '/activities/123',
      params: { include_all_efforts: true },
    });
  });
});
