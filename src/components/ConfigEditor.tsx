import React, { PureComponent, ChangeEvent } from 'react';
import { LegacyForms, Button } from '@grafana/ui';
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

  onResetAccessToken = () => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonFields: {
        ...this.state.config.secureJsonFields,
        accessToken: false,
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

  onResetAuthCode = () => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonFields: {
        ...this.state.config.secureJsonFields,
        authCode: false,
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

  fillAuthCodeFromLocation = () => {
    const result = AuthCodePattern.exec(window.location.search);
    const authCode = result && result.length && result[1];
    this.updateDatasource({
      ...this.state.config,
      secureJsonData: {
        ...this.state.config.secureJsonData,
        authCode,
      },
    });
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
        <h3 className="page-heading">Strava API Details</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form">
              <LegacyForms.FormField
                label="Client ID"
                labelWidth={14}
                inputWidth={30}
                value={config.jsonData.clientID || ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) => this.onClientIDChange(event.target.value)}
              />
            </div>
          </div>
          {config.secureJsonFields && config.secureJsonFields.clientSecret ? (
            <div className="gf-form-inline">
              <div className="gf-form">
                <LegacyForms.FormField
                  label="Client Secret"
                  labelWidth={14}
                  inputWidth={25}
                  placeholder="Configured"
                  disabled={true}
                />
              </div>
              <div className="gf-form">
                <div className="max-width-30 gf-form-inline">
                  <Button variant="secondary" type="button" onClick={this.onResetClientSecret}>
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="gf-form-inline">
              <div className="gf-form">
                <LegacyForms.FormField
                  label="Client Secret"
                  labelWidth={14}
                  inputWidth={30}
                  value={config.secureJsonData ? config.secureJsonData.clientSecret : ''}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => this.onClientSecretChange(event.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        <div className="gf-form-group">
          <a type="button" href={connectWithStravaHref}>
            <img src="public/plugins/grafana-strava-datasource/img/btn_strava_connectwith_orange.svg" />
          </a>
        </div>
      </>
    );
  }
}
