const baseWebpackConfig = require('./webpack.base.conf');

var conf = baseWebpackConfig;
conf.watch = false;
conf.mode = 'development';
conf.devtool = 'source-map';

module.exports = baseWebpackConfig;
