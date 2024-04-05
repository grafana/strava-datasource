import React, { PureComponent, ChangeEvent } from 'react';
import { Button, InlineField, Input, InlineFieldRow, InlineSwitch, Alert, VerticalGroup } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, DataSourceSettings } from '@grafana/data';
import { StravaJsonData, StravaSecureJsonData } from '../types';

const AuthCodePattern = /code=([\w]+)/;

export type Props = DataSourcePluginOptionsEditorProps<StravaJsonData>;

type StravaSettings = DataSourceSettings<StravaJsonData, StravaSecureJsonData>;

export interface State {
  config: StravaSettings;
}

export class ConfigEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { options } = this.props;

    this.state = {
      config: ConfigEditor.defaults(options),
    };

    this.updateDatasource(this.state.config);
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    return {
      ...state,
      config: ConfigEditor.defaults(props.options),
    };
  }

  static defaults = (options: any) => {
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
  };

  updateDatasource = async (config: any) => {
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

    this.props.onOptionsChange({
      ...config,
    });
  };

  onCacheTTLChange = (cacheTTL: string) => {
    this.updateDatasource({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        cacheTTL,
      },
    });
  };

  onResetClientSecret = () => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonFields: {
        ...this.state.config.secureJsonFields,
        clientSecret: false,
      },
    });
  };

  onResetRefreshToken = () => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonFields: {
        ...this.state.config.secureJsonFields,
        refreshToken: false,
      },
    });
  };

  onAccessTokenChange = (accessToken: string) => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonData: {
        ...this.state.config.secureJsonData,
        accessToken,
      },
    });
  };

  onClientIDChange = (clientID: string) => {
    this.updateDatasource({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        clientID,
      },
    });
  };

  onClientSecretChange = (clientSecret: string) => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonData: {
        ...this.state.config.secureJsonData,
        clientSecret,
      },
    });
  };

  onRefreshTokenChange = (refreshToken: string) => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonData: {
        ...this.state.config.secureJsonData,
        refreshToken,
      },
    });
  };

  onAuthCodeChange = (authCode: string) => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonData: {
        ...this.state.config.secureJsonData,
        authCode,
      },
    });
  };

  isLocationContainsCode = () => {
    return AuthCodePattern.test(window.location.search);
  };

  isLocationContainsError = () => {
    return /error=/.test(window.location.search);
  };

  getConnectWithStravaHref = () => {
    const authUrl = 'https://www.strava.com/oauth/authorize';
    const currentLocation = window.location.origin + window.location.pathname;
    const clientID = this.state.config.jsonData.clientID;
    const authScope = 'read_all,profile:read_all,activity:read_all';
    return `${authUrl}?client_id=${clientID}&response_type=code&redirect_uri=${currentLocation}&approval_prompt=force&scope=${authScope}`;
  };

  render() {
    const { config } = this.state;
    const connectWithStravaHref = this.getConnectWithStravaHref();
    const showConnectWithStravaButton = config.jsonData.clientID && config.secureJsonFields.clientSecret;

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
                value={config.jsonData.oauthPassThru || false}
                onChange={(event) =>
                  this.updateDatasource({
                    ...this.state.config,
                    jsonData: {
                      ...this.state.config.jsonData,
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
                value={config.jsonData.clientID || ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) => this.onClientIDChange(event.target.value)}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            {config.secureJsonFields && config.secureJsonFields.clientSecret ? (
              <>
                <InlineField label="Client Secret" labelWidth={16}>
                  <Input placeholder="Configured" width={50} disabled />
                </InlineField>
                <InlineField>
                  <Button variant="secondary" type="button" onClick={this.onResetClientSecret}>
                    Reset
                  </Button>
                </InlineField>
              </>
            ) : (
              <InlineField label="Client Secret" labelWidth={16}>
                <Input
                  width={50}
                  value={config.secureJsonData?.clientSecret || ''}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => this.onClientSecretChange(event.target.value)}
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
                value={config.jsonData.cacheTTL || ''}
                placeholder="1h"
                onChange={(event: ChangeEvent<HTMLInputElement>) => this.onCacheTTLChange(event.target.value)}
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
              {this.isLocationContainsCode() && (
                <Alert severity="info" title={''}>
                  Auth code successfully obtained. Save data source to finish authentication.
                </Alert>
              )}
            </VerticalGroup>
          </div>
        )}
      </>
    );
  }
}
