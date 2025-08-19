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

export const ConfigEditor = (props: Props) => {
  const { onOptionsChange } = props;
  const optionsWithDefaults = getDefaults(props.options);
  const updateDatasource = useCallback(
    (config: any) => {
      const newJsonData = Object.keys(config.jsonData).reduce((acc, key) => {
        if (config.jsonData[key].length === 0) {
          return acc;
        }

        return { ...acc, [key]: config.jsonData[key] };
      }, {});

      const newSecureJsonData = Object.keys(config.secureJsonData).reduce((acc, key) => {
        if (config.secureJsonData[key].length === 0) {
          return acc;
        }

        return { ...acc, [key]: config.secureJsonData[key] };
      }, {});

      onOptionsChange({ ...config, jsonData: { ...newJsonData }, secureJsonData: { ...newSecureJsonData } });
    },
    [onOptionsChange]
  );

  useEffect(() => {
    updateDatasource(optionsWithDefaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCacheTTLChange = (cacheTTL: string) => {
    onOptionsChange({
      ...optionsWithDefaults,
      jsonData: {
        ...optionsWithDefaults.jsonData,
        cacheTTL,
      },
    });
  };

  const onResetClientSecret = () => {
    onOptionsChange({
      ...optionsWithDefaults,
      secureJsonFields: {
        ...optionsWithDefaults.secureJsonFields,
        clientSecret: false,
      },
    });
  };

  const onClientIDChange = (clientID: string) => {
    onOptionsChange({
      ...optionsWithDefaults,
      jsonData: {
        ...optionsWithDefaults.jsonData,
        clientID,
      },
    });
  };

  const onClientSecretChange = (clientSecret: string) => {
    onOptionsChange({
      ...optionsWithDefaults,
      secureJsonData: {
        ...optionsWithDefaults.secureJsonData,
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
    const clientID = optionsWithDefaults.jsonData.clientID;
    const authScope = 'read_all,profile:read_all,activity:read_all';
    return `${authUrl}?client_id=${clientID}&response_type=code&redirect_uri=${currentLocation}&approval_prompt=force&scope=${authScope}`;
  };

  const connectWithStravaHref = getConnectWithStravaHref();
  const showConnectWithStravaButton =
    optionsWithDefaults.jsonData.clientID && optionsWithDefaults.secureJsonFields.clientSecret;

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
              value={optionsWithDefaults.jsonData.oauthPassThru || false}
              onChange={(event) =>
                onOptionsChange({
                  ...optionsWithDefaults,
                  jsonData: {
                    ...optionsWithDefaults.jsonData,
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
              value={optionsWithDefaults.jsonData.clientID || ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onClientIDChange(event.target.value)}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          {optionsWithDefaults.secureJsonFields && optionsWithDefaults.secureJsonFields.clientSecret ? (
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
                value={optionsWithDefaults.secureJsonData?.clientSecret || ''}
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
              value={optionsWithDefaults.jsonData.cacheTTL || ''}
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
  return { secureJsonData: {}, jsonData: {}, secureJsonFields: {}, ...options };
}
