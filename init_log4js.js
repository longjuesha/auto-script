let log4js = require('log4js'), rootPath = require('path').dirname(process.mainModule.filename);
log4js.loadAppender('file');
log4js.replaceConsole();
module.exports.getLogger = (name) => {
  log4js.addAppender(log4js.appenders.file(rootPath + '/' + `logs/${name}.log`), name);
  return log4js.getLogger(name);
};

