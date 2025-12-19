const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const webpack = require('webpack');

module.exports = function override(config, env) {
  config.plugins.push(new MonacoWebpackPlugin());
  
  // Add Node.js polyfills for webpack 5
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer"),
    "url": require.resolve("url/"),
    "path": require.resolve("path-browserify"),
    "crypto": require.resolve("crypto-browserify"),
    "https": require.resolve("https-browserify"),
    "http": require.resolve("stream-http"),
    "fs": false,
    "net": false,
    "tls": false,
    "os": require.resolve("os-browserify/browser"),
    "util": require.resolve("util/"),
  };
  
  // Provide global Buffer and process
  config.plugins.push(
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    })
  );
  
  // Ignore Monaco TypeScript worker warnings (harmless dynamic require warnings)
  config.ignoreWarnings = [
    ...(config.ignoreWarnings || []),
    /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
    /node_modules\/monaco-editor\/esm\/vs\/language\/typescript\/ts\.worker\.js/,
  ];

  return config;
};