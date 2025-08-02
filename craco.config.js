const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Configuration for browser compatibility with crypto libraries
      webpackConfig.resolve.fallback = {
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "http": false,
        "https": false,
        "url": false,
        "buffer": require.resolve("buffer"),
        "util": false,
        "process": require.resolve("process/browser.js")
      };
      
      // Add plugins for polyfills
      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser.js',
        })
      ];
      
      return webpackConfig;
    }
  }
};