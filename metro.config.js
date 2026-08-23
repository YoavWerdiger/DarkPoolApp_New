const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

/**
 * react-native-draggable-flatlist מפנה את שדה "react-native" ל-src/*.tsx.
 * זה שובר HMR (unknown module id / named export חסר). כופים את ה-build המקומפל.
 */
const DRAGGABLE_FLATLIST_ENTRY = path.resolve(
  __dirname,
  'node_modules/react-native-draggable-flatlist/lib/commonjs/index.js'
);

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-draggable-flatlist') {
    return { filePath: DRAGGABLE_FLATLIST_ENTRY, type: 'sourceFile' };
  }
  if (typeof upstreamResolveRequest === 'function') {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' }); 