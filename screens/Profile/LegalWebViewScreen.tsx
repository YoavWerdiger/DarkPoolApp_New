import i18n from '../../lib/i18n';
import React from 'react';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LINKS } from '../../utils/appMeta';

type LegalKind = 'privacy' | 'terms';

/**
 * QA 17.1: רק המסמך — בלי הכותרת של האתר (קישורים למסלולים ולשאר האתר), בלי הפוטר ובלי כפתור הנגישות הצף.
 * CSS לפני טעינת התוכן, כך שהם לא מהבהבים.
 */
const HIDE_SITE_CHROME = `
(function () {
  var css = 'header, footer, button.fixed.bottom-6 { display: none !important; }'
    + ' main#main-content > section:first-child { padding-top: 24px !important; }'
    + ' .scroll-reveal, .split-reveal { opacity: 1 !important; transform: none !important; }';
  function add() {
    if (document.getElementById('dp-legal-css')) return;
    var st = document.createElement('style');
    st.id = 'dp-legal-css';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }
  add();
  document.addEventListener('DOMContentLoaded', add);
})();
true;
`;

/** נשארים רק בעמוד המסמך (גם עוגנים בתוכו); קישור חיצוני → דפדפן; שאר האתר חסום */
function isSameDocument(target: string, docUrl: string): boolean {
  try {
    const a = new URL(target);
    const b = new URL(docUrl);
    const host = (h: string) => h.replace(/^www\./, '');
    return host(a.hostname) === host(b.hostname) && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '');
  } catch {
    return false;
  }
}

export default function LegalWebViewScreen({ navigation, route }: any) {
  const tokens = useDesignTokens();
  const kind: LegalKind = route?.params?.kind === 'terms' ? 'terms' : 'privacy';
  const url = kind === 'terms' ? APP_LINKS.terms : APP_LINKS.privacy;
  const title = kind === 'terms' ? i18n.t('auto.screens__Profile__LegalWebViewScreen.s1') : i18n.t('auto.screens__Profile__LegalWebViewScreen.s2');

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.colors.background.primary }}
      edges={['top', 'bottom']}
    >
      <ChatSubScreenHeader title={title} onBack={() => navigation.goBack()} />
      <View style={{ flex: 1 }}>
        <WebView
          source={{ uri: url }}
          injectedJavaScriptBeforeContentLoaded={HIDE_SITE_CHROME}
          injectedJavaScript={HIDE_SITE_CHROME}
          onShouldStartLoadWithRequest={(req) => {
            if (req.url === 'about:blank' || isSameDocument(req.url, url)) return true;
            const host = (() => {
              try {
                return new URL(req.url).hostname.replace(/^www\./, '');
              } catch {
                return '';
              }
            })();
            // קישור לאתר עצמו (מסלולים, דף הבית) — לא מנווטים; חיצוני (מייל, טלפון וכו') — באפליקציה המתאימה
            if (host !== 'darkpool.site' && req.navigationType === 'click') {
              void Linking.openURL(req.url).catch(() => undefined);
            }
            return false;
          }}
          style={{ flex: 1, backgroundColor: tokens.colors.background.primary }}
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.loading, { backgroundColor: tokens.colors.background.primary }]}>
              <ActivityIndicator color={tokens.colors.primary.main} />
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
