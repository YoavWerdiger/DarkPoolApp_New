module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // babel-preset-expo כבר מוסיף את react-native-worklets/plugin בסוף כשהחבילה מותקנת.
      // אל תוסיפו גם 'react-native-reanimated/plugin' ב-plugins — כפילות שוברת worklets (SIGABRT).
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
