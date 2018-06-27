'use strict';

var Promise = require('bluebird');

module.exports = function(processFile, childPool) {
  return function process(job) {
    return childPool.retain(processFile).then(function(child) {
      child.send({
        cmd: 'start',
        job: job
      });

      var done = new Promise(function(resolve, reject) {
        function handler(msg) {
          switch (msg.cmd) {
            case 'completed':
              child.removeListener('message', handler);
              resolve(msg.value);
              break;
            case 'failed':
            case 'error':
              child.removeListener('message', handler);
              reject(
                typeof msg.value === 'string'
                  ? new Error(msg.value)
                  : toErrorObj(msg.value)
              );
              break;
            case 'progress':
              job.progress(msg.value);
              break;
          }
        }

        child.on('message', handler);
        child.on('exit', function(status) {
          reject(new Error('Child Process Exited: ' + status));
        });
      });

      return done.finally(function() {
        childPool.release(child);
      });
    });
  };
};

function toErrorObj(obj) {
  if (obj instanceof Error) {
    return obj;
  }

  var error = new Error();
  error.message = obj.message;
  error.stack = obj.stack;
  error.name = obj.name;

  return error;
}
