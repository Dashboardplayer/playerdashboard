const webpack = require('webpack');

module.exports = function override(config, env) {
  // Don't minimize so we can debug
  config.optimization.minimize = false;

  // Add fallbacks for node modules
  config.resolve.fallback = {
    crypto: false,
    stream: require.resolve('stream-browserify'),
    assert: require.resolve('assert'),
    http: require.resolve('stream-http'),
    https: require.resolve('https-browserify'),
    os: require.resolve('os-browserify/browser'),
    url: require.resolve('url'),
    buffer: require.resolve('buffer'),
    process: require.resolve('process/browser'),
    path: require.resolve('path-browserify'),
    vm: false,
    fs: false,
    net: false,
    tls: false,
    zlib: false
  };

  // Add module resolution configuration
  config.resolve.extensions = ['.js', '.jsx', '.json', '.ts', '.tsx'];
  config.resolve.modules = ['node_modules', 'src'].concat(config.resolve.modules || []);

  // Add babel configuration for proper module resolution
  config.module.rules.push({
    test: /\.(js|jsx)$/,
    exclude: /node_modules/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: [
          '@babel/preset-env',
          '@babel/preset-react'
        ],
        plugins: [
          ['@babel/plugin-transform-runtime', { regenerator: true }]
        ]
      }
    }
  });

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