module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // חזרה לגרסה יציבה - נשיב את התוסף מאוחר יותר עם ההטמעה
    plugins: [],
  };
}; 