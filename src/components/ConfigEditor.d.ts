import { PureComponent } from 'react';
import { DataSourcePluginOptionsEditorProps, DataSourceSettings } from '@grafana/data';
import { StravaJsonData, StravaSecureJsonData } from '../types';
export declare type Props = DataSourcePluginOptionsEditorProps<StravaJsonData>;
declare type StravaSettings = DataSourceSettings<StravaJsonData, StravaSecureJsonData>;
export interface State {
    config: StravaSettings;
}
export declare class ConfigEditor extends PureComponent<Props, State> {
    constructor(props: Props);
    static getDerivedStateFromProps(props: Props, state: State): {
        config: any;
    };
    static defaults: (options: any) => any;
    updateDatasource: (config: any) => Promise<void>;
    onResetAccessToken: () => void;
    onResetClientSecret: () => void;
    onResetAuthCode: () => void;
    onAccessTokenChange: (accessToken: string) => void;
    onClientIDChange: (clientID: string) => void;
    onClientSecretChange: (clientSecret: string) => void;
    onAuthCodeChange: (authCode: string) => void;
    isLocationContainsCode: () => boolean;
    isLocationContainsError: () => boolean;
    fillAuthCodeFromLocation: () => void;
    getConnectWithStravaHref: () => string;
    render(): JSX.Element;
}
export {};
