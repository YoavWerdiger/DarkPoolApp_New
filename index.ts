import 'react-native-get-random-values'; // Must be first for WebCrypto support (PKCE OAuth)
import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import { maybeCompleteAuthSession } from './lib/expoWebBrowserSafe';
import { registerRootComponent } from 'expo';

// OAuth (Google וכו'): נדרש לסגירת סשן דפדפן אחרי redirect (במיוחד web; לא מזיק ב-native)
maybeCompleteAuthSession();
// שפת ממשק (עברית / אנגלית): כיוון RTL/LTR לפי השפה השמורה, ואתחול התרגומים — לפני App
import { applyLanguageDirection, getStoredLanguage } from './lib/i18n/language';
import './lib/i18n';

applyLanguageDirection(getStoredLanguage());

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
