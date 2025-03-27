const webpack = require('webpack');

module.exports = function override(config, env) {
  // Don't minimize so we can debug
  config.optimization.minimize = false;

  // Add fallbacks for node modules
  config.resolve.fallback = {
    crypto: false,
    stream: require.resolve('stream-browserify'),
    assert: require.resolve('assert/'),
    http: require.resolve('stream-http'),
    https: require.resolve('https-browserify'),
    os: require.resolve('os-browserify/browser'),
    url: require.resolve('url/'),
    buffer: require.resolve('buffer/'),
    process: require.resolve('process/browser'),
    path: require.resolve('path-browserify'),
    vm: false,
    fs: false,
    net: false,
    tls: false,
    zlib: false
  };

  // Add plugins
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  ];

  return config;
};