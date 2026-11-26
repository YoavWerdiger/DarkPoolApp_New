module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // babel-preset-expo כבר מוסיף את react-native-worklets/plugin בסוף כשהחבילה מותקנת.
      // אל תוסיפו גם 'react-native-reanimated/plugin' ב-plugins — כפילות שוברת worklets (SIGABRT).
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    env: {
      // בילד פרודקשן: בלי console.log/info/debug (ביצועים + לא לחשוף מידע בלוגים של המכשיר).
      // console.error / console.warn נשארים — Sentry אוסף אותם.
      production: {
        plugins: [["transform-remove-console", { exclude: ["error", "warn"] }]],
      },
    },
  };
};
