function requestStatsMiddleware(req, res, next) {
  if (!global.requestStats) {
    global.requestStats = [];
  }

  const start = Date.now();
  const originalEnd = res.end;

  res.end = function(...args) {
    global.requestStats.push({
      path: req.path,
      method: req.method,
      status: res.statusCode,
      duration: Date.now() - start,
      timestamp: Date.now()
    });

    if (global.requestStats.length > 1000) {
      global.requestStats = global.requestStats.slice(-1000);
    }

    originalEnd.apply(this, args);
  };

  next();
}

module.exports = { requestStatsMiddleware };
