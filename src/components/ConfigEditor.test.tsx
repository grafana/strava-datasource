import React from 'react';
import { render } from '@testing-library/react';
import { ConfigEditor } from './ConfigEditor';
import { DataSourceSettings } from '@grafana/data';
import { StravaJsonData, StravaSecureJsonData } from 'types';

describe('ConfigEditor', () => {
  describe('on initial render', () => {
    it('should not mutate the options object', () => {
      const options = Object.freeze({ ...defaultOptions }); // freezing the options to prevent mutations
      Object.freeze(options.jsonData);
      Object.freeze(options.secureJsonData);
      Object.freeze(options.secureJsonFields);
      const onOptionsChangeSpy = jest.fn();

      expect(() => render(<ConfigEditor options={options} onOptionsChange={onOptionsChangeSpy} />)).not.toThrow();
    });

    it('should call onOptionsChange and remove any empty props in jsonData and secureJsonData', () => {
      const options = Object.freeze({ ...defaultOptions }); // freezing the options to prevent mutations
      Object.freeze(options.jsonData);
      Object.freeze(options.secureJsonData);
      Object.freeze(options.secureJsonFields);
      const onOptionsChangeSpy = jest.fn();

      expect(() => render(<ConfigEditor options={options} onOptionsChange={onOptionsChangeSpy} />)).not.toThrow();
      expect(onOptionsChangeSpy).toHaveBeenCalledTimes(1);
      expect(onOptionsChangeSpy).toHaveBeenCalledWith({
        ...defaultOptions,
        jsonData: { oauthPassThru: false },
        secureJsonData: {},
      });
    });

    it('should set defaults that are missing', () => {
      const options: any = { ...defaultOptions };
      delete options.secureJsonData;
      delete options.secureJsonFields;
      delete options.jsonData;
      const frozen = Object.freeze(options); // freezing the options to prevent mutations
      const onOptionsChangeSpy = jest.fn();

      expect(() =>
        render(<ConfigEditor options={Object.freeze(frozen)} onOptionsChange={onOptionsChangeSpy} />)
      ).not.toThrow();
      expect(onOptionsChangeSpy).toHaveBeenCalledTimes(1);
      expect(onOptionsChangeSpy).toHaveBeenCalledWith({
        ...defaultOptions,
        jsonData: {},
        secureJsonData: {},
        secureJsonFields: {},
      });
    });
  });
});

const defaultOptions: DataSourceSettings<StravaJsonData, StravaSecureJsonData> = {
  id: 1,
  orgId: 1,
  uid: 'xyz',
  name: 'strava',
  typeLogoUrl: '',
  type: '',
  typeName: '',
  access: '',
  url: '',
  user: '',
  database: '',
  basicAuth: false,
  basicAuthUser: '',
  isDefault: false,
  jsonData: {
    cacheTTL: '',
    clientID: '',
    oauthPassThru: false,
  },
  readOnly: false,
  secureJsonData: {
    clientSecret: '',
  },
  secureJsonFields: {},
  withCredentials: false,
};
