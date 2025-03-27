const webpack = require('webpack');

module.exports = function override(config, env) {
  const isProduction = env === 'production';

  // Configure optimization
  if (isProduction) {
    config.optimization = {
      ...config.optimization,
      minimize: true,
      splitChunks: {
        chunks: 'all',
      },
    };
  }

  // Configure resolve
  config.resolve = {
    ...config.resolve,
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      assert: require.resolve('assert'),
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      os: require.resolve('os-browserify/browser'),
      url: require.resolve('url'),
      buffer: require.resolve('buffer'),
      process: require.resolve('process/browser'),
      path: require.resolve('path-browserify'),
      util: require.resolve('util'),
      fs: false,
      net: false,
      tls: false,
      zlib: false,
      vm: false,
    },
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
  };

  // Configure plugins
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    })
  ];

  return config;
};