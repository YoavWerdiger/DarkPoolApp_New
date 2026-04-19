import React, { useMemo } from 'react';
import { View, ActivityIndicator, Platform, StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { useDesignTokens } from '../../../components/ui/DesignTokens';

const WEB_SOURCE_BASE = 'https://tradingview.com';

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
        source={{ html, baseUrl: WEB_SOURCE_BASE }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scalesPageToFit={Platform.OS === 'android'}
        scrollEnabled
        nestedScrollEnabled
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator
        showsHorizontalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        renderLoading={() => (
          <View style={loadingOverlay}>
            <ActivityIndicator size="large" color={tokens.colors.primary.main} />
          </View>
        )}
      />
    </View>
  );
}
