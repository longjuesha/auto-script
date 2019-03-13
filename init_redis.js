"use strict";
let core, config, logger, client = null,
    _ = require('lodash'), m = require('redis');

let serviceName = 'redis';
let redis = {
  assert: (error) => {
    if (error) {
      logger.error(error);
      throw '[' + serviceName + '] ' + error;
    }
  },
  init: (callback, utils, redisConfig) => {
    logger = utils.log4js.getLogger('redis');
    if (redisConfig.password) {
      options.auth_pass = redisConfig.password;
    }
    client = m.createClient(redisConfig.port || 6379, redisConfig.host || '127.0.0.1', options);
    client.on('error', redis.assert);
    client.on('connect', callback);
  },
  uninit: () => {
    if (client) {
      client.quit();
    }
  },
  getClient: () => client
};

module.exports = redis;
