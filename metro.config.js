const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Alias react-native-maps to @teovilla/react-native-web-maps on web
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-maps': '@teovilla/react-native-web-maps',
};

module.exports = config;
