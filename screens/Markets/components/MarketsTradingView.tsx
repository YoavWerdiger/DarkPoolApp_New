import React, { useCallback, useMemo, useState } from 'react';
import { View, ActivityIndicator, Platform, StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { useDesignTokens } from '../../../components/ui/DesignTokens';

type Props = {
  html: string;
  instanceKey: string;
  /** When set, the WebView sits in a fixed-height container (e.g. indices tab). */
  height?: number;
  /** Use flex:1 when true (heatmaps, screener, fullscreen). */
  flexFill?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  /** רקע שכבת הטעינה — ברירת מחדל elevated; שקוף לשיטי זכוכית. */
  loadingBackgroundColor?: string;
};

type NavRequest = { url: string; isTopFrame?: boolean };

/** מסמך ה-HTML המקומי + blob/data — לא ניווט לדף TradingView מלא. */
function isLocalDocumentUrl(url: string) {
  return (
    !url ||
    url === 'about:blank' ||
    url.startsWith('about:srcdoc') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  );
}

/** דפי סימול/צ'ארט מלאים — גם בתוך iframe של הווידג'ט. */
function isTradingViewFullPage(url: string) {
  return /tradingview\.com\/(?:symbols?|chart|ideas|news|support|pricing)\b/i.test(url);
}

/**
 * חוסם מעבר ל-tradingview.com (לחיצה על סימול בווידג'ט) אבל מאפשר
 * טעינת iframes/סקריפטים של ה-embed עצמו (isTopFrame === false ב-iOS).
 * ב-Android onShouldStartLoadWithRequest נקרא בעיקר ל-main frame.
 */
function shouldAllowTradingViewNav(request: NavRequest) {
  const url = request.url || '';
  if (isLocalDocumentUrl(url)) return true;
  if (!/^https?:\/\//i.test(url)) return true;

  // דף סימול/צ'ארט — גם אם הניווט הוא בתוך iframe
  if (isTradingViewFullPage(url)) return false;

  // iframe של הווידג'ט (embed/assets) — לאפשר
  if (request.isTopFrame === false) return true;

  // כל ניווט top-level ל-http(s) = פתיחת דף מחוץ ל-about:blank
  return false;
}

/** חוסם <a> במסמך האב (לא חוצה iframe — לזה יש onShouldStartLoadWithRequest). */
const BLOCK_ANCHOR_NAV_JS = `
(function () {
  try {
    document.addEventListener('click', function (e) {
      var el = e.target;
      while (el && el.tagName !== 'A') el = el.parentElement;
      if (el && el.tagName === 'A') {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  } catch (_) {}
  true;
})();
`;

/**
 * TradingView ב-WebView. לא משתמשים ב-startInLoadingState/renderLoading —
 * עם source={{ html }} ה-overlay של RN לעיתים נשאר לתמיד מעל התוכן
 * (ספינר כחול על רשימת טיקרים חצי-טעונה ב"מה זז היום").
 */
export function MarketsTradingView({
  html,
  instanceKey,
  height,
  flexFill,
  containerStyle,
  loadingBackgroundColor,
}: Props) {
  const tokens = useDesignTokens();
  const [loading, setLoading] = useState(true);

  const onShouldStartLoadWithRequest = useCallback(
    (request: NavRequest) => {
      const allow = shouldAllowTradingViewNav(request);
      if (!allow && __DEV__) {
        // eslint-disable-next-line no-console
        console.log(`[TV:${instanceKey}] blocked nav`, request.url);
      }
      return allow;
    },
    [instanceKey]
  );

  const overlayBg = loadingBackgroundColor ?? tokens.colors.background.elevated;

  const loadingOverlay = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: overlayBg,
      zIndex: 2,
    }),
    [overlayBg]
  );

  const outerStyle: StyleProp<ViewStyle> = [
    {
      borderRadius: tokens.borderRadius.lg,
      overflow: 'hidden',
      ...(flexFill ? { flex: 1, minHeight: 0 } : {}),
      ...(height != null ? { height } : {}),
    },
    containerStyle,
  ];

  return (
    <View style={outerStyle}>
      <WebView
        key={instanceKey}
        // הערה: לא משתמשים ב-baseUrl. ב-iOS WKWebView, קביעת baseUrl לדומיין רחוק
        // (כגון tradingview.com) משנה את ה-origin של המסמך וגורמת ל-iframes של
        // TradingView להיכשל בטעינה בגלל הבדלי origin/redirect ל-www.tradingview.com.
        source={{ html }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        scalesPageToFit={Platform.OS === 'android'}
        scrollEnabled
        nestedScrollEnabled
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator
        showsHorizontalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        injectedJavaScript={BLOCK_ANCHOR_NAV_JS}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onOpenWindow={() => {
          // target=_blank / window.open מדפי TradingView — לא לפתוח
        }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => {
          setLoading(false);
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn(`[TV:${instanceKey}] WebView error`, e.nativeEvent);
          }
        }}
        onHttpError={(e) => {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn(`[TV:${instanceKey}] WebView http error`, e.nativeEvent);
          }
        }}
        onMessage={(e) => {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.log(`[TV:${instanceKey}] msg`, e.nativeEvent.data);
          }
        }}
      />
      {loading ? (
        <View style={loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={tokens.colors.primary.main} />
        </View>
      ) : null}
    </View>
  );
}
