const webpack = require('webpack');

module.exports = function override(config) {
  // Add fallbacks for node core modules
  config.resolve.fallback = {
    buffer: require.resolve('buffer/'),
    process: require.resolve('process/browser'),
    crypto: require.resolve('crypto-browserify'),
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