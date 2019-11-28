import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import StravaDatasource from './datasource';
import { StravaJsonData, StravaQuery } from './types';

class StravaAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin<StravaDatasource, StravaQuery, StravaJsonData>(
  StravaDatasource
)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setAnnotationQueryCtrl(StravaAnnotationsQueryCtrl);
