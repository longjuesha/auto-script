let _ = require('lodash'), logger, mysqlConfig, m = require('mysql'), pool, conn;
let serviceName = 'mysql';

let mysql = {
  assert: (error, sql) => {
    if (error) {
      if (sql) {
        logger.error('Error sql: [' + sql + ']');
      }
      logger.error(error);
      throw '[' + serviceName + '] ' + error;
    }
  },
  init: (callback, utils, mysqlConfig) => {
    logger = utils.log4js.getLogger('mysql');
    pool = m.createPool({
      host: mysqlConfig.host,
      user: mysqlConfig.user,
      password: mysqlConfig.password,
      port: mysqlConfig.port,
      database: mysqlConfig.database
    });
    callback(pool);
  },
  query: (sql, callback) => {
    pool.getConnection(function(err, connection) {
      mysql.assert(err); 
      connection.query(sql, (error, result) => {
        mysql.assert(error, sql); 
        connection.release();
        callback(err, result);
      });
    });
  },
  uninit: () => {
    pool.end();
  },
  getConfig: () => mysqlConfig
};

module.exports = mysql;
