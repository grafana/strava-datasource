import { PureComponent } from 'react';
import { SelectableValue, QueryEditorProps } from '@grafana/data';
import { StravaActivityStat, StravaActivityType, StravaJsonData, StravaQuery, StravaQueryFormat, StravaQueryInterval, StravaQueryType } from '../types';
import StravaDatasource from '../datasource';
export declare const DefaultTarget: State;
export interface Props extends QueryEditorProps<StravaDatasource, StravaQuery, StravaJsonData> {
}
interface State extends StravaQuery {
    athlete: any;
}
export declare class QueryEditor extends PureComponent<Props, State> {
    state: State;
    queryDefaults: Partial<StravaQuery>;
    componentDidMount(): Promise<void>;
    getSelectedQueryType: () => SelectableValue<StravaQueryType> | undefined;
    getSelectedActivityStat: () => SelectableValue<StravaActivityStat> | undefined;
    getSelectedActivityType: () => SelectableValue<StravaActivityType> | undefined;
    getFormatOption: () => SelectableValue<StravaQueryFormat> | undefined;
    getIntervalOption: () => SelectableValue<StravaQueryInterval> | undefined;
    onQueryTypeChanged: (option: SelectableValue<StravaQueryType>) => void;
    onActivityStatChanged: (option: SelectableValue<StravaActivityStat>) => void;
    onActivityTypeChanged: (option: SelectableValue<StravaActivityType>) => void;
    onFormatChange: (option: SelectableValue<StravaQueryFormat>) => void;
    onIntervalChange: (option: SelectableValue<StravaQueryInterval>) => void;
    onChange(query: StravaQuery): void;
    render(): JSX.Element;
}
export {};
