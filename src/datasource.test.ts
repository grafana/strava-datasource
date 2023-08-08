import { dateMath } from '@grafana/data';
import StravaDatasource from './datasource';
import { StravaQueryType } from './types';

jest.mock(
  '@grafana/runtime',
  () => ({
    getBackendSrv: () => ({
      datasourceRequest: jest.fn().mockResolvedValue({ data: { result: '' } }),
      fetch: () => ({
        toPromise: () => jest.fn().mockResolvedValue({ data: { result: '' } }),
      }),
    }),
    getTemplateSrv: () => ({
      replace: jest.fn().mockImplementation((query) => query),
    }),
  }),
  { virtual: true }
);

describe('StravaDatasource', () => {
  const ctx: any = {
    backendSrv: {},
    templateSrv: {},
    ds: undefined,
    options: undefined,
    instanceSettings: {} as any,
    timeSrv: {
      timeRange: () => {
        return {
          to: { diff: () => 3600 },
          from: {},
        };
      },
    },
  };

  beforeEach(() => {
    ctx.backendSrv = {
      datasourceRequest: () => {
        return Promise.resolve({
          status: 200,
          data: {},
        });
      },
    };
    ctx.templateSrv = {
      replace: (str: string, scopedVars: any) => {
        for (const key in scopedVars) {
          str = str.replace(`$${key}`, scopedVars[key].value);
        }
        return str;
      },
    };

    ctx.instanceSettings = {
      id: 123,
      url: '',
      jsonData: {
        stravaAuthType: 'oauth',
        oauthPassThru: false,
      },
    };
    ctx.ds = new StravaDatasource(ctx.instanceSettings);
  });

  describe('When query activities', () => {
    beforeEach(() => {
      const targets = [
        {
          queryType: StravaQueryType.Activities,
        },
      ];

      ctx.options = {
        range: {
          from: dateMath.parse('2023-01-01T00:00:01.000+00:00'),
          to: dateMath.parse('2023-06-01T00:00:00.000+00:00'),
        },
        targets,
      };
    });

    it('should round time range to hit the cache', async () => {
      const spy = jest.spyOn(ctx.ds.stravaApi, 'getActivities');
      await ctx.ds.query(ctx.options);
      expect(spy).toHaveBeenLastCalledWith({
        after: 1672531200,
        before: 1685577600,
      });
    });
  });
});
