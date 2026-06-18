import React, { useMemo } from 'react';
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
};

export function MarketsTradingView({ html, instanceKey, height, flexFill, containerStyle }: Props) {
  const tokens = useDesignTokens();

  const loadingOverlay = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: tokens.colors.background.elevated,
    }),
    [tokens.colors.background.elevated]
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
        startInLoadingState
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
        onError={(e) => {
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
        renderLoading={() => (
          <View style={loadingOverlay}>
            <ActivityIndicator size="large" color={tokens.colors.primary.main} />
          </View>
        )}
      />
    </View>
  );
}
