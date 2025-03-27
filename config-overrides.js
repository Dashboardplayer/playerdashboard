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