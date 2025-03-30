const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = function override(config) {
  // Don't minimize in development
  if (process.env.NODE_ENV === 'development') {
    config.optimization.minimize = false;
  }

  // Add Node polyfill plugin
  config.plugins = [
    ...config.plugins,
    new NodePolyfillPlugin(),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  ];

  // Add fallbacks for node core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    buffer: require.resolve('buffer/'),
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    assert: require.resolve('assert/'),
    http: require.resolve('stream-http'),
    https: require.resolve('https-browserify'),
    os: require.resolve('os-browserify/browser'),
    url: require.resolve('url/'),
    util: require.resolve('util/'),
    path: require.resolve('path-browserify'),
    process: require.resolve('process/browser'),
    zlib: require.resolve('browserify-zlib'),
    fs: false,
    net: false,
    tls: false,
    child_process: false
  };

  // Ignore source-map warnings
  config.ignoreWarnings = [/Failed to parse source map/];

  // Return the modified config
  return config;
};