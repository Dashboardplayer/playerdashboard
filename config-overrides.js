const webpack = require('webpack');

module.exports = function override(config) {
  // Add fallbacks for node core modules
  config.resolve.fallback = {
    buffer: require.resolve('buffer/'),
    process: require.resolve('process/browser'),
    crypto: require.resolve('crypto-browserify'),
    path: require.resolve('path-browserify'),
    stream: require.resolve('stream-browserify'),
    os: require.resolve('os-browserify/browser'),
    util: require.resolve('util/'),
    assert: require.resolve('assert/'),
    fs: false,
    net: false,
    tls: false,
    child_process: false
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