var _ = require('lodash'), logger, mongoConfig,
    MongoClient = require('mongodb').MongoClient, MongoDb;
let serviceName = 'mongodb';

let mongodb = {
  assert: (error, sql) => {
    if (error) {
      logger.error(error);
      throw '[' + serviceName + '] ' + error;
    }
  },
  init: (callback, utils, mongoConfig) => {
    var url = 'mongodb://' + mongoConfig.host + ':' + mongoConfig.port +'/' + mongoConfig.name;
    MongoClient.connect(url, function(err, db) {
      logger = utils.log4js.getLogger('mongodb');
      
      MongoDb = db;
      db.on('error', function(error) {
        mongodb.assert(error);
      });
      if (!mongoConfig.user || !mongoConfig.password) {
        callback(err, db);
      } else {
        db.authenticate(mongoConfig.user, mongoConfig.password, function(error, result) {
          mongodb.assert(error);
          callback(error, db);
        });
      }
    });
  },
  getConfig: () => mongoConfig,
  getCol: (c) => MongoDb.collection(c),
  uninit: () => MongoDb.close()
};

module.exports = mongodb;
