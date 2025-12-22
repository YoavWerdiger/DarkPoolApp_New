import React, { useMemo } from 'react';
import { View, Text, Dimensions, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import FearAndGreedCard from '../../components/News/FearAndGreedCard';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = (hex || '').trim();
  const match = /^#?([0-9a-f]{6})$/i.exec(normalized);
  if (!match) return `rgba(41, 98, 255, ${alpha})`; // fallback
  const intVal = parseInt(match[1], 16);
  const r = (intVal >> 16) & 255;
  const g = (intVal >> 8) & 255;
  const b = intVal & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getTradingViewMarketOverviewHTML = (tokens: ReturnType<typeof useDesignTokens>) => {
  const growing = tokens.colors.primary.main;
  const falling = tokens.colors.danger?.main || tokens.colors.text.danger;

  const config = {
    colorTheme: 'dark',
    dateRange: '3M',
    locale: 'he_IL',
    largeChartUrl: '',
    isTransparent: true,
    showFloatingTooltip: false,
    plotLineColorGrowing: hexToRgba(growing, 1),
    plotLineColorFalling: hexToRgba(falling, 1),
    gridLineColor: 'rgba(240, 243, 250, 0)',
    scaleFontColor: '#DBDBDB',
    belowLineFillColorGrowing: hexToRgba(growing, 0.12),
    belowLineFillColorFalling: hexToRgba(falling, 0.12),
    belowLineFillColorGrowingBottom: hexToRgba(growing, 0),
    belowLineFillColorFallingBottom: hexToRgba(falling, 0),
    symbolActiveColor: hexToRgba(growing, 0.12),
    tabs: [
      {
        title: 'מדדים',
        symbols: [
          { s: 'FOREXCOM:SPXUSD', d: 'מדד ה-S&P 500' },
          { s: 'FOREXCOM:NSXUSD', d: 'מדד ה-Nasdaq 100' },
          { s: 'FOREXCOM:DJI', d: 'מדד ה-Dow Jones' },
          {
            s: 'CAPITALCOM:RTY',
            d: 'מדד ה- Russell 2000',
            logoid: 'indices/russell-2000',
            'currency-logoid': 'country/US',
          },
        ],
        originalTitle: 'Bonds',
      },
      {
        title: 'חוזים עתידיים',
        symbols: [
          { s: 'CME_MINI:ES1!', d: 'חוזים עתיידים על ה-S&P 500' },
          { s: 'CME_MINI:NQ1!', d: 'חוזים עתידיים על ה- Nasdaq 100' },
          { s: 'CBOT_MINI:YM1!', d: 'חוזים עתידיים על ה- Dow Jones' },
          { s: 'CME_MINI:RTY1!', d: 'חוזים עתידיים על ה- Russelle 2000' },
        ],
      },
      {
        title: 'סחורות ',
        symbols: [
          { s: 'OANDA:XAUUSD', d: 'זהב', logoid: 'metal/gold', 'currency-logoid': 'country/US' },
          { s: 'TVC:SILVER', d: 'סילבר', logoid: 'metal/silver', 'currency-logoid': 'country/US' },
          { s: 'MATBAROFEX:WTI1!', d: 'נפט' },
          { s: 'SKILLING:NATGAS', d: 'גז טבעי', logoid: 'natural-gas', 'currency-logoid': 'country/US' },
        ],
      },
      {
        title: 'קריפטו ',
        symbols: [
          { s: 'BINANCE:BTCUSDT', d: 'ביטקוין', 'base-currency-logoid': 'crypto/XTVCBTC', 'currency-logoid': 'crypto/XTVCUSDT' },
          { s: 'BINANCE:ETHUSDT', d: 'אית׳ריום', 'base-currency-logoid': 'crypto/XTVCETH', 'currency-logoid': 'crypto/XTVCUSDT' },
          { s: 'BINANCE:XRPUSDT', d: 'אקס-אר-פי', 'base-currency-logoid': 'crypto/XTVCXRP', 'currency-logoid': 'crypto/XTVCUSDT' },
          { s: 'BINANCE:SOLUSDT', d: 'סולנה', 'base-currency-logoid': 'crypto/XTVCSOL', 'currency-logoid': 'crypto/XTVCUSDT' },
          { s: 'VANTAGE:BTCETH', d: 'ביטקוין מול איתריום (דומיננטיות)', 'base-currency-logoid': 'crypto/XTVCBTC', 'currency-logoid': 'crypto/XTVCETH' },
        ],
      },
      {
        title: 'מט״ח',
        symbols: [
          { s: 'OANDA:EURUSD', d: 'יורו / דולר אמריקאי', 'base-currency-logoid': 'country/EU', 'currency-logoid': 'country/US' },
          { s: 'OANDA:USDJPY', d: 'דולר אמריקאי / ין יפני', 'base-currency-logoid': 'country/US', 'currency-logoid': 'country/JP' },
          { s: 'OANDA:GBPUSD', d: 'ליש”ט / דולר אמריקאי', 'base-currency-logoid': 'country/GB', 'currency-logoid': 'country/US' },
          { s: 'OANDA:AUDUSD', d: 'דולר אוסטרלי / דולר אמריקאי', 'base-currency-logoid': 'country/AU', 'currency-logoid': 'country/US' },
          { s: 'OANDA:USDCAD', d: 'דולר אמריקאי / דולר קנדי', 'base-currency-logoid': 'country/US', 'currency-logoid': 'country/CA' },
        ],
      },
    ],
    support_host: 'https://www.tradingview.com',
    backgroundColor: tokens.colors.background.secondary,
    width: '100%',
    height: '100%',
    showSymbolLogo: true,
    showChart: true,
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
      background-color: transparent;
      overflow: hidden;
    }
    .tradingview-widget-container {
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
    }
    .tradingview-widget-container__widget {
      flex: 1;
      min-height: 0;
    }
    .tradingview-widget-copyright {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      overflow: hidden !important;
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  <div class="tradingview-widget-container">
    <div class="tradingview-widget-container__widget"></div>
    <div class="tradingview-widget-copyright">
      <a href="https://il.tradingview.com/markets/" rel="noopener nofollow" target="_blank">
        <span class="blue-text">Track all markets on TradingView</span>
      </a>
    </div>
    <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js" async>
    ${JSON.stringify(config, null, 2)}
    </script>
  </div>
</body>
</html>
  `;
};

export default function IndicesTab() {
  const DesignTokens = useDesignTokens();
  const mainTabsHeight = useMainTabsHeight();
  const styles = useMemo(
    () => ({
      container: {
        flex: 1,
      },
      scrollContent: {
        paddingHorizontal: DesignTokens.spacing.lg,
        paddingTop: DesignTokens.spacing.lg,
      },
      widgetCard: {
        marginTop: DesignTokens.spacing.xs,
        marginBottom: DesignTokens.spacing.lg,
      } as const,
      widgetTitle: {
        fontSize: DesignTokens.typography.fontSize.lg,
        fontWeight: DesignTokens.typography.fontWeight.bold as any,
        color: DesignTokens.colors.text.primary,
        textAlign: 'right' as const,
        marginBottom: DesignTokens.spacing.sm,
      },
      webviewContainer: {
        height: SCREEN_HEIGHT * 0.4,
        borderRadius: DesignTokens.borderRadius.md,
        overflow: 'hidden' as const,
      },
      webview: {
        flex: 1,
        backgroundColor: DesignTokens.colors.background.secondary,
      },
      loadingContainer: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
    }),
    [DesignTokens]
  );

  const widgetHtml = useMemo(
    () => getTradingViewMarketOverviewHTML(DesignTokens),
    [DesignTokens]
  );

  return (
    <View style={styles.container}>
      <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ווידג'ט מדדים של TradingView למעלה */}
        <UICard 
          variant="blur" 
          padding="md" 
          style={{
            ...styles.widgetCard,
            ...DesignTokens.shadows.lg,
          }}
        >
          <Text style={styles.widgetTitle}>מדדי שוק מרכזיים</Text>
          <View style={styles.webviewContainer}>
            <WebView
              source={{ html: widgetHtml }}
              style={[styles.webview, { backgroundColor: 'transparent' }]}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              originWhitelist={['*']}
              mixedContentMode="always"
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              nestedScrollEnabled={true}
              scrollEnabled={true}
              bounces={false}
              showsVerticalScrollIndicator={true}
              showsHorizontalScrollIndicator={false}
              onLoadStart={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.log('📊 IndicesTab: Loading started', nativeEvent.url);
              }}
              onLoadEnd={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.log('✅ IndicesTab: Loading ended', nativeEvent.url);
              }}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('❌ IndicesTab: Error', nativeEvent);
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('❌ IndicesTab: HTTP Error', nativeEvent.statusCode, nativeEvent.url);
              }}
              onShouldStartLoadWithRequest={(request) => {
                console.log('🔍 IndicesTab: Request to load:', request.url);
                // מונע ניווט חיצוני - שומר את כל הניווט בתוך ה-WebView
                const shouldLoad = request.url.startsWith('about:blank') || request.url.includes('tradingview.com');
                console.log('🔍 IndicesTab: Should load:', shouldLoad);
                return shouldLoad;
              }}
            />
          </View>
        </UICard>

        {/* Fear & Greed מתחת למדדים – פתוח ותופס רוחב מלא */}
        <FearAndGreedCard initialExpanded disableToggle fullWidth />
        </ScrollView>
      </View>
    </View>
  );
}
