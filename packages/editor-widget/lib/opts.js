var path = require('path');
var rc = require('rc');
var util = require('@slaap/slap-util');

var configFile = path.resolve(__dirname, '../default-config.ini');
var pkgConfigName = 'editor-widget';

module.exports = util.parseOpts(rc(pkgConfigName, configFile));
