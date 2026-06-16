import { DataSourcePlugin } from '@grafana/data';
import { StravaVariableQueryEditor } from './components/VariableQueryEditor';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import StravaDatasource from './datasource';
import { StravaJsonData, StravaQuery, StravaSecureJsonData } from './types';

export const plugin = new DataSourcePlugin<StravaDatasource, StravaQuery, StravaJsonData, StravaSecureJsonData>(
  StravaDatasource
)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setVariableQueryEditor(StravaVariableQueryEditor);
