var _ = require('lodash'), async = require('async'), exec = require('child_process').exec, crypto = require('crypto'), 
    path = require('path'), rootPath = require('path').dirname(process.mainModule.filename), 
    fs = require('fs'), dataPath, readLine = require('lei-stream').readLine, mysqlConfig, mongoConfig, redisConfig;

//加
Number.prototype.add = function(arg) {
  var r1, r2, m;
  try{r1 = this.toString().split(".")[1].length;}catch(e){r1 = 0;}
  try{r2 = arg.toString().split(".")[1].length;}catch(e){r2 = 0;}
  m = Math.pow(10, Math.max(r1, r2));
  return (this * m + arg * m) / m;
};
// 减法
Number.prototype.sub = function(arg) {
  return this.add(-arg);
};

// 乘法
Number.prototype.mul = function(arg) {
  var m = 0, s1 = this.toString(), s2 = arg.toString();
  try{m += s1.split(".")[1].length;}catch(e){}
  try{m += s2.split(".")[1].length;} catch(e){}
  return Number(s1.replace(".", "")) * Number(s2.replace(".", ""))/ Math.pow(10, m);
};
String.prototype.ResetBlank = function() {
 var regEx = /\s+/g; 
 return this.replace(regEx, ' '); 
};
// 除法
Number.prototype.div = function(arg) {
  var t1 = 0, t2 = 0, r1, r2;
  try {t1 = this.toString().split(".")[1].length;}catch(e){}
  try {t2 = arg.toString().split(".")[1].length;}catch(e){}
  with (Math) {
    r1 = Number(this.toString().replace(".", ""));
    r2 = Number(arg.toString().replace(".", ""));
    return (r1 / r2) * pow(10, t2 - t1);
  }
};

Date.prototype.format = function(format) {
  var date = {
    'M+': this.getMonth() + 1,
    'd+': this.getDate(),
    'h+': this.getHours(),
    'm+': this.getMinutes(),
    's+': this.getSeconds(),
    'q+': Math.floor((this.getMonth() + 3) / 3),
    'S+': this.getMilliseconds()
  };
  if (/(y+)/i.test(format)) {
    format = format.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length));
  }
  for (var k in date) {
    if (new RegExp('(' + k + ')').test(format)) {
      format = format.replace(RegExp.$1, RegExp.$1.length == 1 ? date[k] : ('00' + date[k]).substr(('' + date[k]).length));
    }
  }
  return format;
};

module.exports = (action, options) => {
  options.config = options.config || 'etc/config.js';
  var config = require(rootPath + '/' + options.config);
  mysqlConfig = _.get(config, 'mysql', false);
  mongoConfig = _.get(config, 'mongodb', false);
  redisConfig = _.get(config, 'redis', false);
  var enforcementInterval = _.get(config, 'enforcementInterval', 0);
  async.auto({
    check: (callback) => {
      if (require('os').platform() == 'linux') {
        var now = Date.parse(new Date())/1000;
        if(fs.existsSync('/tmp/' + path.basename(process.argv[1]) + '.pid')) {
          var contentText = fs.readFileSync('/tmp/' + path.basename(process.argv[1]) + '.pid','utf-8');
          if(contentText < (now - enforcementInterval)) {
            fs.writeFileSync('/tmp/' + path.basename(process.argv[1]) + '.pid', now);
            console.log(`距离上次执行超过${enforcementInterval}秒，强制执行`);
            callback();
          } else {
            console.log('上次运行未完成');
            process.exit();
          }
        } else {
          fs.writeFileSync('/tmp/' + path.basename(process.argv[1]) + '.pid', now);
          callback();
        }
      } else {
        return callback();
      }
    },
    log4js: ['check', (util, callback) => {
      callback(null, require('./init_log4js'));
    }],
    mongodb: ['log4js', (util, callback) => {
      if (mongoConfig) {
        let mongodb = require('./init_mongodb');
        mongodb.init(() => {
          callback(null, mongodb);
        }, util, mongoConfig);
      } else {
        callback(null, {});
      }
    }],
    mysql: ['log4js', (util, callback) => {
      if (mysqlConfig) {
        var mysql = require('./init_mysql');
        mysql.init((pool) => {
          callback(null, mysql);
        }, util, mysqlConfig);
      } else {
        callback(null, {});
      }
    }],
    redis: ['mysql', (util, callback) => {
      if (redisConfig) {
        var redis = require('./init_redis');
        redis.init(() => {
          redis = redis.getClient();
          callback(null, redis);
        }, util, redisConfig);
      } else {
        callback(null, {});
      }
    }],
    action: ['redis', (utils, callback) => {
      utils.rootPath = __dirname;
      utils.funGetDateFromYYYYMMDD = (timeStr) => {
        var time = /(\d+)-(\d+)-(\d+)/.exec(timeStr);
        return new Date(parseInt(time[1]), parseInt(time[2]) - 1, parseInt(time[3]));
      };
      utils.getWeekOfYear = (date) => {
        var d1 = date, d2 = new Date(date.getFullYear(), 0, 1),
          d = Math.round((d1 - d2) / 86400000);
        return Math.ceil((d + ((d2.getDay() + 1) - 1)) / 7);
      };
      utils.funMongoFind = (table, query, pathName, next, callback, fields) => {
        let mConfig = utils.mongodb.getConfig(), _execStr = [
            `mongoexport -h ${mConfig.host} --port ${mConfig.port} -d ${mConfig.name}`,
            mConfig.user ? ` -u ${mConfig.user} -p ${mConfig.password}` : ''
          ].join('');

        let dataPath = path.resolve(utils.rootPath, pathName);
        query = require('os').platform() == 'win32' ?
          `"${JSON.stringify(query).replace(/"/g, "'")}"` :
          `'${JSON.stringify(query)}'`;
        fields = fields ? '-f ' + fields.join(','): '';
        let jsonFile = path.resolve(dataPath, `${table}.dat`), execStr = [
          _execStr, `-c ${table}`, `-q ${query}`, fields, `-o ${jsonFile}`
        ].join(' ');
        exec(execStr, (error, stdout, stderr) => {
          if (error) {
            fs.unlinkSync('/tmp/' + path.basename(process.argv[1]) + '.pid');
            return callback(error);
          }
          var lines = readLine(fs.createReadStream(jsonFile), {
            // 换行符，默认\n
            newline: '\n',
            // 是否自动读取下一行，默认false
            autoNext: true,
            // 编码器，可以为函数或字符串（内置编码器：json，base64），默认null
            encoding: function (data) {
              let err = null, result = {};
              try{
                result = JSON.parse(data);
              }catch(e) {
                result = {};
                err = `JSON error`;
              }
              return next(err, result);
            }
          });
          // lines.on('data', function (data) {
          //   setTimeout(function(){lines.next();}, 1);
          // });
          lines.on('end', function () {
            callback();
          });
        });
      };

      utils.fsExists = (path) => {
        fs.exists(path, function(exists) {
          if(!exists) {
            fs.writeFile(path, 1, function(err) {
              return true;
            });
          }else {
            return false;
          }
        });
      };

      //创建APP存放文件夹
      utils.fsMkdir = (host) => {
        fs.readdir(host, function (err, files) {
          if (err) {
            fs.mkdir(host, function (err) {
              if (err) {
                return;
              }
            });
          }
        });
      };
      //删除文件和文件夹
      utils.deleteFolder = (path) => {
        var files = [];
        if(fs.existsSync(path)) {
          files = fs.readdirSync(path);
          files.forEach(function(file, index) {
            var curPath = path + "/" + file;
            if(fs.statSync(curPath).isDirectory()) { // recurse
              deleteFolder(curPath);
            } else { // delete file
              fs.unlinkSync(curPath);
            }
          });
          fs.rmdirSync(path);
        }
      };

      //md5加密
      utils.md5 = (text) => {
        return crypto.createHash('md5').update(text).digest('hex');
      };
      utils.objKeySort = (obj) => {//排序的函数
        let newkey = Object.keys(obj).sort();
        let newObj = {};
        for (let i = 0; i < newkey.length; i++) {
          newObj[newkey[i]] = obj[newkey[i]];
        }
        return newObj;//返回排好序的新对象
      };
      utils.createSign = (params, appsecret) => {
        let paramstring = '', sign;
        params =  utils.objKeySort(params);
        _.forEach(params, (value, key) => {
          paramstring = paramstring + key + value;
        });
        sign = utils.md5(appsecret + paramstring + appsecret).toUpperCase();
        return sign;
      };
      //超过18位数字JSON解析
      utils.longNumberJsonParse = (baseStr) => {
        if (!baseStr || typeof baseStr != 'string') return;
        var jsonData = null;
        try {
          jsonData = JSON.parse(baseStr);
        } catch (err){
          return null;
        }
        var needReplaceStrs = [];
        loopFindArrOrObj(jsonData,needReplaceStrs);
        needReplaceStrs.forEach(function (replaceInfo) {
          var matchArr = baseStr.match(eval('/"'+ replaceInfo.key + '":[0-9]{15,}/'));
          if (matchArr) {
            var str = matchArr[0];
            var replaceStr = str.replace('"' + replaceInfo.key + '":','"' + replaceInfo.key + '":"');
            replaceStr += '"';
            baseStr = baseStr.replace(str,replaceStr);
          }
        });
        var returnJson = null;
        try {
          returnJson = JSON.parse(baseStr);
        }catch (err){
          return null;
        }
        return returnJson;
      };

      //遍历对象类型的
      function getNeedRpStrByObj(obj,needReplaceStrs) {
        for (var key in obj) {
          var value = obj[key];
          if (typeof value == 'number' && value > 9007199254740992) {
            needReplaceStrs.push({key:key});
          }
          loopFindArrOrObj(value,needReplaceStrs);
        }
      }

      //遍历数组类型的
      function getNeedRpStrByArr(arr,needReplaceStrs) {
        for(var i=0; i<arr.length; i++) {
          var value = arr[i];
          loopFindArrOrObj(value,needReplaceStrs);
        }
      }

      //递归遍历
      function loopFindArrOrObj(value,needRpStrArr) {
        var valueTypeof = Object.prototype.toString.call(value);
        if (valueTypeof == '[object Object]') {
          needRpStrArr.concat(getNeedRpStrByObj(value,needRpStrArr));
        }
        if (valueTypeof == '[object Array]') {
          needRpStrArr.concat(getNeedRpStrByArr(value,needRpStrArr));
        }
      }
      
      action(utils, callback);
    }]
  }, function(err, result) {
    if (err) {
      var logger = result.log4js.getLogger('autoScript');
      logger.error(err);
    }
    if (require('os').platform() == 'linux') {
      fs.unlink('/tmp/' + path.basename(process.argv[1]) + '.pid', function(err) {
        if(err){
          console.log('文件:'+ path.basename(process.argv[1]) + '.pid' +'删除失败！');
        }
        result.mongodb && result.mongodb.close();
        _.isFunction(_.get(result, 'action.uninit')) && result.action.uninit();
        process.exit();
      });
    } else {
       result.mongodb && result.mongodb.close();
        _.isFunction(_.get(result, 'action.uninit')) && result.action.uninit();
      process.exit();
    }
  });
};

process.on('uncaughtException', function(err) {
  if (require('os').platform() == 'linux') {
    fs.unlinkSync('/tmp/' + path.basename(process.argv[1]) + '.pid');
  }
  process.exit(1);
});
