import React, { PureComponent, ChangeEvent } from 'react';
import { FormLabel, Select, Input, Button } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, DataSourceSettings } from '@grafana/data';
import { SelectableValue } from '@grafana/data';
//@ts-ignore
import { getDatasourceSrv } from 'grafana/app/features/plugins/datasource_srv';
// import CloudWatchDatasource from '../datasource';
import { StravaJsonData, StravaSecureJsonData } from '../types';

export type Props = DataSourcePluginOptionsEditorProps<StravaJsonData>;

type CloudwatchSettings = DataSourceSettings<StravaJsonData, StravaSecureJsonData>;

export interface State {
  config: CloudwatchSettings;
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
    options.jsonData.authType = options.jsonData.authType || 'credentials';
    options.jsonData.timeField = options.jsonData.timeField || '@timestamp';

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
  }

  onResetAccessToken = () => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonFields: {
        ...this.state.config.secureJsonFields,
        accessToken: false,
      },
    });
  }

  onResetClientSecret = () => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonFields: {
        ...this.state.config.secureJsonFields,
        clientSecret: false,
      },
    });
  }

  onAccessTokenChange = (accessToken: string) => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonData: {
        ...this.state.config.secureJsonData,
        accessToken,
      },
    });
  }

  onClientIDChange = (clientID: string) => {
    this.updateDatasource({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        clientID,
      },
    });
  }

  onClientSecretChange = (clientSecret: string) => {
    this.updateDatasource({
      ...this.state.config,
      secureJsonData: {
        ...this.state.config.secureJsonData,
        clientSecret,
      },
    });
  }

  render() {
    const { config } = this.state;

    return (
      <>
        <h3 className="page-heading">Strava API Details</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel className="width-14">Client ID</FormLabel>
              <div className="width-30">
                <Input
                  className="width-30"
                  value={config.jsonData.clientID || ''}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => this.onClientIDChange(event.target.value)}
                />
              </div>
            </div>
          </div>
          {config.secureJsonFields.clientSecret ? (
            <div className="gf-form-inline">
              <div className="gf-form">
                <FormLabel className="width-14">Client Secret</FormLabel>
                <Input className="width-25" placeholder="Configured" disabled={true} />
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
                <FormLabel className="width-14">Client Secret</FormLabel>
                <div className="width-30">
                  <Input
                    className="width-30"
                    value={config.secureJsonData.clientSecret || ''}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => this.onClientSecretChange(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          {config.secureJsonFields.accessToken ? (
            <div className="gf-form-inline">
              <div className="gf-form">
                <FormLabel className="width-14">Access Token</FormLabel>
                <Input className="width-25" placeholder="Configured" disabled={true} />
              </div>
              <div className="gf-form">
                <div className="max-width-30 gf-form-inline">
                  <Button variant="secondary" type="button" onClick={this.onResetAccessToken}>
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="gf-form-inline">
              <div className="gf-form">
                <FormLabel className="width-14">Access Token</FormLabel>
                <div className="width-30">
                  <Input
                    className="width-30"
                    value={config.secureJsonData.accessToken || ''}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => this.onAccessTokenChange(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }
}
