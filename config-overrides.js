const webpack = require('webpack');

module.exports = function override(config, env) {
  // Configure resolve
  config.resolve = {
    ...config.resolve,
    fallback: {
      crypto: false, // We'll use our local polyfill instead
      buffer: require.resolve('buffer/'),
      stream: require.resolve('stream-browserify'),
      process: require.resolve('process/browser'),
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      url: require.resolve('url/'),
      assert: require.resolve('assert/'),
      os: require.resolve('os-browserify/browser'),
      path: require.resolve('path-browserify'),
      util: require.resolve('util/'),
      zlib: require.resolve('browserify-zlib'),
      fs: false,
      net: false,
      tls: false,
      child_process: false,
      vm: false,
    },
  };

  // Configure plugins
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ];

  return config;
};