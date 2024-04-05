import React, { ChangeEvent, useEffect, useCallback } from 'react';
import { Button, InlineField, Input, InlineFieldRow, InlineSwitch, Alert, VerticalGroup } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, DataSourceSettings } from '@grafana/data';
import { StravaJsonData, StravaSecureJsonData } from '../types';

const AuthCodePattern = /code=([\w]+)/;

export type Props = DataSourcePluginOptionsEditorProps<StravaJsonData, StravaSecureJsonData>;

type StravaSettings = DataSourceSettings<StravaJsonData, StravaSecureJsonData>;

export interface State {
  config: StravaSettings;
}

export const ConfigEditor = ({ options, onOptionsChange }: Props) => {
  const updateDatasource = useCallback(
    (config: any) => {
      for (const j in config.jsonData) {
        if (config.jsonData[j].length === 0) {
          delete config.jsonData[j];
        }
      }

      for (const k in config.secureJsonData) {
        if (config.secureJsonData[k].length === 0) {
          delete config.secureJsonData[k];
        }
      }

      onOptionsChange({
        ...config,
      });
    },
    [onOptionsChange]
  );

  useEffect(() => {
    updateDatasource(getDefaults(options));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCacheTTLChange = (cacheTTL: string) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        cacheTTL,
      },
    });
  };

  const onResetClientSecret = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        clientSecret: false,
      },
    });
  };

  const onClientIDChange = (clientID: string) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        clientID,
      },
    });
  };

  const onClientSecretChange = (clientSecret: string) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        ...options.secureJsonData,
        clientSecret,
      },
    });
  };

  const isLocationContainsCode = () => {
    return AuthCodePattern.test(window.location.search);
  };

  const isLocationContainsError = () => {
    return /error=/.test(window.location.search);
  };

  const getConnectWithStravaHref = () => {
    const authUrl = 'https://www.strava.com/oauth/authorize';
    const currentLocation = window.location.origin + window.location.pathname;
    const clientID = options.jsonData.clientID;
    const authScope = 'read_all,profile:read_all,activity:read_all';
    return `${authUrl}?client_id=${clientID}&response_type=code&redirect_uri=${currentLocation}&approval_prompt=force&scope=${authScope}`;
  };

  const connectWithStravaHref = getConnectWithStravaHref();
  const showConnectWithStravaButton = options.jsonData.clientID && options.secureJsonFields.clientSecret;

  return (
    <>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <InlineField
            label="Forward OAuth Identity"
            tooltip="Forward the user's upstream OAuth identity to the data source (Their access token gets passed along)."
            labelWidth={26}
          >
            <InlineSwitch
              id="http-settings-forward-oauth"
              value={options.jsonData.oauthPassThru || false}
              onChange={(event) =>
                onOptionsChange({
                  ...options,
                  jsonData: {
                    ...options.jsonData,
                    oauthPassThru: event!.currentTarget.checked,
                  },
                })
              }
            />
          </InlineField>
        </div>
      </div>
      <h2 className="page-heading">Strava API Details</h2>
      <div className="gf-form-group">
        <InlineFieldRow>
          <InlineField label="Client ID" labelWidth={16}>
            <Input
              width={50}
              value={options.jsonData.clientID || ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onClientIDChange(event.target.value)}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          {options.secureJsonFields && options.secureJsonFields.clientSecret ? (
            <>
              <InlineField label="Client Secret" labelWidth={16}>
                <Input placeholder="Configured" width={50} disabled />
              </InlineField>
              <InlineField>
                <Button variant="secondary" type="button" onClick={onResetClientSecret}>
                  Reset
                </Button>
              </InlineField>
            </>
          ) : (
            <InlineField label="Client Secret" labelWidth={16}>
              <Input
                width={50}
                value={options.secureJsonData?.clientSecret || ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onClientSecretChange(event.target.value)}
              />
            </InlineField>
          )}
        </InlineFieldRow>
      </div>
      <div className="gf-form-group">
        <InlineFieldRow>
          <InlineField
            label="Cache TTL"
            labelWidth={16}
            tooltip="Plugin stores activities and other data in cache to improve performance and avoid API rate limits."
          >
            <Input
              width={10}
              value={options.jsonData.cacheTTL || ''}
              placeholder="1h"
              onChange={(event: ChangeEvent<HTMLInputElement>) => onCacheTTLChange(event.target.value)}
            />
          </InlineField>
        </InlineFieldRow>
      </div>
      {showConnectWithStravaButton && (
        <div className="gf-form-group">
          <VerticalGroup>
            <a type="button" href={connectWithStravaHref}>
              <img src="public/plugins/grafana-strava-datasource/img/btn_strava_connectwith_orange.svg" />
            </a>
            {isLocationContainsCode() && (
              <Alert severity="success" title={''}>
                Auth code successfully obtained. Save data source to finish authentication.
              </Alert>
            )}
            {isLocationContainsError() && (
              <Alert severity="error" title={''}>
                Error obtaining auth code.
              </Alert>
            )}
          </VerticalGroup>
        </div>
      )}
    </>
  );
};

function getDefaults(options: any) {
  if (!options.hasOwnProperty('secureJsonData')) {
    options.secureJsonData = {};
  }

  if (!options.hasOwnProperty('jsonData')) {
    options.jsonData = {};
  }

  if (!options.hasOwnProperty('secureJsonFields')) {
    options.secureJsonFields = {};
  }

  return options;
}
