module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets plugin powers Reanimated; must be listed last.
    plugins: ['react-native-worklets/plugin'],
  };
};
