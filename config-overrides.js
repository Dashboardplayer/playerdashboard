const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = function override(config, env) {
  // Add fallbacks for node modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "assert": require.resolve("assert/"),
    "http": require.resolve("stream-http"),
    "https": require.resolve("https-browserify"),
    "os": require.resolve("os-browserify/browser"),
    "url": require.resolve("url/"),
    "buffer": require.resolve("buffer/"),
    "process": require.resolve("process/browser"),
    "path": require.resolve("path-browserify"),
    "fs": false,
    "net": false,
    "tls": false,
    "zlib": false
  };

  // Add plugins
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
      console: ['console-browserify']
    }),
    new NodePolyfillPlugin({
      includeAliases: ['console']
    })
  ];

  return config;
};