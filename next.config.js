/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ensure config.resolve exists
      config.resolve = config.resolve || {};
      // Ensure fallback exists
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // Only include crypto since it's used in shared utilities
        crypto: require.resolve('crypto-browserify'),
        // Explicitly disable vm since it's handled by node-polyfill-webpack-plugin
        vm: false
      };
    }
    return config;
  },
};

module.exports = nextConfig; 