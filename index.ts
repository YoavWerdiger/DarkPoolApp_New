import 'react-native-get-random-values'; // Must be first for WebCrypto support (PKCE OAuth)
import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import { maybeCompleteAuthSession } from './lib/expoWebBrowserSafe';
import { registerRootComponent } from 'expo';

// OAuth (Google וכו'): נדרש לסגירת סשן דפדפן אחרי redirect (במיוחד web; לא מזיק ב-native)
maybeCompleteAuthSession();
import { I18nManager } from 'react-native';

try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} catch {
  /* מסביבות ישנות / Hermes — לא לשבור את האתחול */
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
