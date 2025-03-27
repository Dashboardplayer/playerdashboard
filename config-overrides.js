const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

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
      console: require.resolve('console-browserify'),
      fs: false,
      net: false,
      tls: false,
      zlib: false,
      vm: false,
    },
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: ['node_modules', 'src'].concat(config.resolve.modules || []),
  };

  // Configure module rules
  config.module.rules.push({
    test: /\.(js|jsx)$/,
    exclude: /node_modules/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: ['@babel/preset-env', '@babel/preset-react'],
        plugins: [['@babel/plugin-transform-runtime', { regenerator: true }]]
      }
    }
  });

  // Configure plugins
  config.plugins = [
    ...config.plugins.filter(plugin => 
      plugin.constructor.name !== 'NodePolyfillPlugin' && 
      plugin.constructor.name !== 'ProvidePlugin'
    ),
    new NodePolyfillPlugin({
      excludeAliases: ['console']
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
      console: ['console-browserify']
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    })
  ];

  return config;
};