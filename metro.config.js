const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Text גלובלי (Heebo לפי משקל): כל בקשה ל-Text של react-native — גם מתוך ספריות ו-Animated.Text —
// מופנית ל-components/ui/appText.tsx. הבקשה מתוך appText עצמו (לקובץ המקורי) לא מופנית.
const APP_TEXT = path.resolve(__dirname, 'components/ui/appText.tsx');
const RN_TEXT_RE = /(^|[\\/])Libraries[\\/]Text[\\/]Text(\.js)?$/;
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstreamResolve || context.resolveRequest;
  const result = resolve(context, moduleName, platform);
  if (
    result &&
    result.type === 'sourceFile' &&
    RN_TEXT_RE.test(result.filePath.replace(/\.js$/, '')) &&
    /[\\/]react-native[\\/]Libraries[\\/]Text[\\/]Text\.js$/.test(result.filePath) &&
    context.originModulePath !== APP_TEXT
  ) {
    return { type: 'sourceFile', filePath: APP_TEXT };
  }
  return result;
};

module.exports = withNativeWind(config, { input: './global.css' });
