module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Basic webpack configuration for browser compatibility
      webpackConfig.resolve.fallback = {
        "crypto": false,
        "stream": false,
        "http": false,
        "https": false,
        "url": false,
        "buffer": false,
        "util": false
      };
      return webpackConfig;
    }
  }
};