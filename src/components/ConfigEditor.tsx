import React, { PureComponent, ChangeEvent } from 'react';
import { Button, RadioButtonGroup, InlineField, Input } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, DataSourceSettings } from '@grafana/data';
import { StravaAuthType, StravaJsonData, StravaSecureJsonData } from '../types';

const AuthCodePattern = /code=([\w]+)/;

const authOptions = [
  { label: 'OAuth', value: StravaAuthType.OAuth },
  { label: 'Refresh token', value: StravaAuthType.RefreshToken },
];

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

    if (!options.jsonData.stravaAuthType) {
      options.jsonData.stravaAuthType = StravaAuthType.OAuth;
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

  onAuthTypeChange = (value?: StravaAuthType) => {
    this.updateDatasource({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        stravaAuthType: value,
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

    return (
      <>
        <h2 className="page-heading">Strava API Details</h2>
        <div className="gf-form-group">
          <h5>Auth type</h5>
          <RadioButtonGroup
            options={authOptions}
            value={config.jsonData.stravaAuthType}
            onChange={this.onAuthTypeChange}
          />
        </div>
        <div className="gf-form-group">
          <InlineField label="Client ID" labelWidth={16}>
            <Input
              width={50}
              value={config.jsonData.clientID || ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) => this.onClientIDChange(event.target.value)}
            />
          </InlineField>
          {config.secureJsonFields && config.secureJsonFields.clientSecret ? (
            <InlineField label="Client Secret" labelWidth={16}>
              <>
                <Input placeholder="Configured" width={50} disabled />
                <Button variant="secondary" type="button" onClick={this.onResetClientSecret}>
                  Reset
                </Button>
              </>
            </InlineField>
          ) : (
            <InlineField label="Client Secret" labelWidth={16}>
              <Input
                width={50}
                value={config.secureJsonData?.clientSecret || ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) => this.onClientSecretChange(event.target.value)}
              />
            </InlineField>
          )}
          {config.jsonData?.stravaAuthType === StravaAuthType.RefreshToken && (
            <>
              {config.secureJsonFields && config.secureJsonFields.refreshToken ? (
                <InlineField label="Refresh Token" labelWidth={16}>
                  <>
                    <Input placeholder="Configured" width={50} disabled />
                    <Button variant="secondary" type="button" onClick={this.onResetRefreshToken}>
                      Reset
                    </Button>
                  </>
                </InlineField>
              ) : (
                <InlineField label="Refresh Token" labelWidth={16}>
                  <Input
                    width={50}
                    value={config.secureJsonData?.refreshToken || ''}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => this.onRefreshTokenChange(event.target.value)}
                  />
                </InlineField>
              )}
            </>
          )}
        </div>
        {config.jsonData?.stravaAuthType !== StravaAuthType.RefreshToken && (
          <div className="gf-form-group">
            <a type="button" href={connectWithStravaHref}>
              <img src="public/plugins/grafana-strava-datasource/img/btn_strava_connectwith_orange.svg" />
            </a>
          </div>
        )}
      </>
    );
  }
}
