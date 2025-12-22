import React, { useMemo, useState } from 'react';
import { View, Text, Dimensions, ScrollView, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import FearAndGreedCard from '../../components/News/FearAndGreedCard';
import { TrendingUp, DollarSign, Coins, Map } from 'lucide-react-native';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = (hex || '').trim();
  const match = /^#?([0-9a-f]{6})$/i.exec(normalized);
  if (!match) return `rgba(41, 98, 255, ${alpha})`;
  const intVal = parseInt(match[1], 16);
  const r = (intVal >> 16) & 255;
  const g = (intVal >> 8) & 255;
  const b = intVal & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const TAB_HTML_TEMPLATE = (bodyContent: string) => `
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
  ${bodyContent}
</body>
</html>
`;

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
        title: 'סחורות ',
        symbols: [
          { s: 'OANDA:XAUUSD', d: 'זהב', logoid: 'metal/gold', 'currency-logoid': 'country/US' },
          { s: 'TVC:SILVER', d: 'סילבר', logoid: 'metal/silver', 'currency-logoid': 'country/US' },
          { s: 'MATBAROFEX:WTI1!', d: 'נפט' },
          { s: 'SKILLING:NATGAS', d: 'גז טבעי', logoid: 'natural-gas', 'currency-logoid': 'country/US' },
        ],
      },
      {
        title: 'מט״ח',
        symbols: [
          { s: 'OANDA:EURUSD', d: 'יורו / דולר אמריקאי', 'base-currency-logoid': 'country/EU', 'currency-logoid': 'country/US' },
          { s: 'OANDA:USDJPY', d: 'דולר אמריקאי / ין יפני', 'base-currency-logoid': 'country/US', 'currency-logoid': 'country/JP' },
          { s: 'OANDA:GBPUSD', d: 'ליש"ט / דולר אמריקאי', 'base-currency-logoid': 'country/GB', 'currency-logoid': 'country/US' },
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

  const body = `
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
  `;

  return TAB_HTML_TEMPLATE(body);
};

const getTradingViewHeatmapHTML = (type: 'stock' | 'crypto' | 'nasdaq') => {
  let widgetSrc = '';
  // הגדרה בסיסית של הקונפיגורציה עם טיפוס 'any' כדי לאפשר גמישות
  let config: any = {};

  if (type === 'crypto') {
    widgetSrc = 'https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js';
    config = {
      dataSource: "Crypto",
      blockSize: "market_cap_calc",
      blockColor: "24h_close_change|5",
      locale: "he_IL",
      symbolUrl: "",
      colorTheme: "dark",
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: "100%",
      height: "100%"
    };
  } else if (type === 'nasdaq') {
    // Nasdaq 100 Heatmap
    widgetSrc = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
    config = {
      dataSource: "NASDAQCOMPOSITE",
      blockSize: "market_cap_basic",
      blockColor: "change",
      grouping: "sector",
      locale: "he_IL",
      symbolUrl: "",
      colorTheme: "dark",
      exchanges: [],
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: "100%",
      height: "100%"
    };
  } else {
    // Stock (S&P 500) by default
    widgetSrc = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
    config = {
      dataSource: "SPX500",
      blockSize: "market_cap_basic",
      blockColor: "change",
      grouping: "sector",
      locale: "he_IL",
      symbolUrl: "",
      colorTheme: "dark",
      exchanges: [],
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: "100%",
      height: "100%"
    };
  }

  const body = `
  <div class="tradingview-widget-container">
    <div class="tradingview-widget-container__widget"></div>
    <div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a></div>
    <script type="text/javascript" src="${widgetSrc}" async>
    ${JSON.stringify(config, null, 2)}
    </script>
  </div>
  `;

  return TAB_HTML_TEMPLATE(body);
};

const getTradingViewScreenerHTML = (
  type: 'stock' | 'crypto' | 'forex',
  tokens: ReturnType<typeof useDesignTokens>
) => {
  const widgetUrl = 'https://s3.tradingview.com/external-embedding/embed-widget-screener.js';

  let config: any = {};

  switch (type) {
    case 'stock':
      config = {
        market: 'america',
        showToolbar: true,
        defaultColumn: 'overview',
        defaultScreen: 'most_capitalized',
        isTransparent: true,
        locale: 'he_IL',
        colorTheme: 'dark',
        width: '100%',
        height: '100%',
      };
      break;
    case 'crypto':
      config = {
        market: 'crypto',
        showToolbar: true,
        defaultColumn: 'overview',
        defaultScreen: 'general',
        isTransparent: true,
        locale: 'he_IL',
        colorTheme: 'dark',
        width: '100%',
        height: '100%',
      };
      break;
    case 'forex':
      config = {
        market: 'forex',
        showToolbar: true,
        defaultColumn: 'overview',
        defaultScreen: 'general',
        isTransparent: true,
        locale: 'he_IL',
        colorTheme: 'dark',
        width: '100%',
        height: '100%',
      };
      break;
  }

  const body = `
  <div class="tradingview-widget-container">
    <div class="tradingview-widget-container__widget"></div>
    <div class="tradingview-widget-copyright"><a href="https://il.tradingview.com/markets/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a></div>
    <script type="text/javascript" src="${widgetUrl}" async>
    ${JSON.stringify(config, null, 2)}
    </script>
  </div>
  `;

  return TAB_HTML_TEMPLATE(body);
};

type MarketsTab = 'indices' | 'heatmaps' | 'screener' | 'feargreed';

export default function MarketsScreen() {
  const DesignTokens = useDesignTokens();
  const [activeTab, setActiveTab] = useState<MarketsTab>('indices');

  // State for Heatmaps Tab
  const [heatmapType, setHeatmapType] = useState<'stock' | 'crypto' | 'nasdaq'>('stock');

  // State for Screener Tab
  const [screenerType, setScreenerType] = useState<'stock' | 'crypto' | 'forex'>('stock');

  const mainTabsHeight = useMainTabsHeight();

  const styles = useMemo(
    () => ({
      container: {
        flex: 1,
      },
      gradientContainer: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      },
      safeAreaContainer: {
        flex: 1,
      },
      headerContainer: {
        paddingHorizontal: DesignTokens.spacing.lg,
        paddingTop: DesignTokens.spacing.lg,
      },
      headerTitle: {
        fontSize: DesignTokens.typography.fontSize['2xl'],
        fontWeight: DesignTokens.typography.fontWeight.bold as any,
        color: DesignTokens.colors.text.primary,
        textAlign: 'right' as const,
      },
      headerSubtitle: {
        fontSize: DesignTokens.typography.fontSize.base,
        color: DesignTokens.colors.text.secondary,
        textAlign: 'right' as const,
        marginTop: DesignTokens.spacing.xs,
        marginBottom: DesignTokens.spacing.sm,
      },
      tabsContainer: {
        paddingHorizontal: DesignTokens.spacing.lg,
        paddingTop: DesignTokens.spacing.md,
        marginBottom: DesignTokens.spacing.md,
      },
      tabsCard: {
        borderRadius: 30,
        overflow: 'hidden' as const,
        alignSelf: 'center' as const,
        width: '100%' as const,
        maxWidth: 400,
      },
      tabs: {
        flexDirection: 'row' as const,
        padding: 4,
      },
      tab: {
        flex: 1,
        height: 44,
        borderRadius: 26,
        backgroundColor: 'transparent',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        flexDirection: 'row' as const,
        gap: 6,
        marginHorizontal: 2,
        position: 'relative' as const,
      },
      tabActiveIndicator: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 26,
        backgroundColor: `${DesignTokens.colors.primary.main}14`,
      },
      tabText: {
        fontSize: DesignTokens.typography.fontSize.sm,
        fontWeight: DesignTokens.typography.fontWeight.medium as any,
        color: DesignTokens.colors.text.secondary,
        textAlign: 'center' as const,
      },
      tabTextActive: {
        color: DesignTokens.colors.primary.main,
        fontWeight: DesignTokens.typography.fontWeight.bold as any,
      },
      tabContent: {
        flex: 1,
      },
      scrollContent: {
        paddingHorizontal: DesignTokens.spacing.lg,
        paddingTop: DesignTokens.spacing.lg,
        paddingBottom: mainTabsHeight,
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
        height: SCREEN_HEIGHT * 0.7, // גובה נוח
        borderRadius: DesignTokens.borderRadius.md,
        overflow: 'hidden' as const,
      },
      webview: {
        flex: 1,
        backgroundColor: 'transparent',
        opacity: 0.99, // Hack for Android rendering
      },
      filterButtons: {
        flexDirection: 'row' as const,
        justifyContent: 'flex-end' as const,
        gap: DesignTokens.spacing.sm,
        marginBottom: DesignTokens.spacing.md,
        flexWrap: 'wrap' as const,
      },
      filterButton: {
        paddingHorizontal: DesignTokens.spacing.md,
        paddingVertical: DesignTokens.spacing.sm,
        borderRadius: DesignTokens.borderRadius.md,
        backgroundColor: DesignTokens.colors.background.elevated,
        borderWidth: 1,
        borderColor: DesignTokens.colors.border.primary,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 6,
      },
      filterButtonActive: {
        backgroundColor: DesignTokens.colors.primary.main,
        borderColor: DesignTokens.colors.primary.main,
      },
      filterButtonText: {
        color: DesignTokens.colors.text.primary,
        fontSize: DesignTokens.typography.fontSize.sm,
        fontWeight: DesignTokens.typography.fontWeight.medium as any,
      },
      filterButtonTextActive: {
        color: '#FFFFFF',
      },
      loadingOverlay: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        backgroundColor: DesignTokens.colors.background.elevated,
      }
    }),
    [DesignTokens, mainTabsHeight]
  );

  const marketOverviewHtml = useMemo(
    () => getTradingViewMarketOverviewHTML(DesignTokens),
    [DesignTokens]
  );

  const heatmapHtml = useMemo(
    () => getTradingViewHeatmapHTML(heatmapType),
    [heatmapType]
  );

  const screenerHtml = useMemo(
    () => getTradingViewScreenerHTML(screenerType, DesignTokens),
    [screenerType, DesignTokens]
  );

  const tabs: Array<{ id: MarketsTab; title: string }> = [
    { id: 'indices', title: 'מדדים' },
    { id: 'heatmaps', title: 'מפות חום' },
    { id: 'screener', title: 'סורק' },
    { id: 'feargreed', title: 'מדד הפחד' },
  ];

  const renderWebView = (html: string, key: string) => (
    <View style={styles.webviewContainer}>
      <WebView
        key={key}
        source={{ html, baseUrl: 'https://tradingview.com' }}
        style={styles.webview}
        androidLayerType="software"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // Enable gestures
        scalesPageToFit={true}
        scrollEnabled={true}
        nestedScrollEnabled={true}
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={true}
        showsHorizontalScrollIndicator={false}
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          </View>
        )}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
        locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
        style={styles.gradientContainer}
      />
      <StatusBar style="light" />
      <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
        {/* כותרת */}
        <View style={styles.headerContainer}>
          <UICard variant="blur" padding="lg">
            <Text style={styles.headerTitle}>שווקים</Text>
            <Text style={styles.headerSubtitle}>
              סקירה מקיפה של השווקים הפיננסים
            </Text>
          </UICard>
        </View>

        {/* טאבים ראשיים */}
        <View style={styles.tabsContainer}>
          <UICard variant="blur" padding="none" style={styles.tabsCard}>
            <View style={styles.tabs}>
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    activeOpacity={0.7}
                    style={styles.tab}
                  >
                    {isActive && <View style={styles.tabActiveIndicator} />}
                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                      {tab.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </UICard>
        </View>

        {/* תוכן - ללא ScrollView במפות ובסורק כדי לאפשר גלילה/זום פנימי */}
        <View style={styles.tabContent}>
          {activeTab === 'indices' && (
            <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
              <ScrollView contentContainerStyle={{ paddingHorizontal: DesignTokens.spacing.lg }} showsVerticalScrollIndicator={false}>
                <UICard variant="blur" padding="md" style={{ ...styles.widgetCard, ...DesignTokens.shadows.lg }}>
                  <Text style={styles.widgetTitle}>מדדים ועתידיים</Text>
                  {/* גובה קבוע למדדים */}
                  <View style={{ height: SCREEN_HEIGHT * 0.6, borderRadius: DesignTokens.borderRadius.md, overflow: 'hidden' }}>
                    <WebView
                      key="market-overview"
                      source={{ html: marketOverviewHtml, baseUrl: 'https://tradingview.com' }}
                      style={styles.webview}
                      androidLayerType="software"
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      startInLoadingState={true}
                      originWhitelist={['*']}
                      mixedContentMode="always"
                      showsVerticalScrollIndicator={false}
                      renderLoading={() => (
                        <View style={styles.loadingOverlay}>
                          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
                        </View>
                      )}
                    />
                  </View>
                </UICard>
              </ScrollView>
            </View>
          )}

          {activeTab === 'heatmaps' && (
            <View style={{ flex: 1, paddingHorizontal: DesignTokens.spacing.lg, marginBottom: mainTabsHeight - 12 }}>
              {/* Sub-tabs bar like main tabs */}
              <UICard variant="blur" padding="none" style={{ borderRadius: 30, overflow: 'hidden', marginBottom: DesignTokens.spacing.md }}>
                <View style={{ flexDirection: 'row', padding: 4 }}>
                  {[
                    { id: 'stock', label: 'S&P500' },
                    { id: 'nasdaq', label: 'Nasdaq' },
                    { id: 'crypto', label: 'קריפטו' },
                  ].map((tab) => {
                    const isActive = heatmapType === tab.id;
                    return (
                      <TouchableOpacity
                        key={tab.id}
                        onPress={() => setHeatmapType(tab.id as any)}
                        activeOpacity={0.7}
                        style={{
                          flex: 1,
                          height: 40,
                          borderRadius: 26,
                          backgroundColor: 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginHorizontal: 2,
                          position: 'relative',
                        }}
                      >
                        {isActive && (
                          <View style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            borderRadius: 26,
                            backgroundColor: `${DesignTokens.colors.primary.main}14`,
                          }} />
                        )}
                        <Text style={{
                          fontSize: DesignTokens.typography.fontSize.sm,
                          fontWeight: isActive ? DesignTokens.typography.fontWeight.bold as any : DesignTokens.typography.fontWeight.medium as any,
                          color: isActive ? DesignTokens.colors.primary.main : DesignTokens.colors.text.secondary,
                          textAlign: 'center',
                        }}>{tab.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </UICard>

              {/* Heatmap content */}
              <UICard variant="blur" padding="md" style={{ flex: 1, ...DesignTokens.shadows.lg }} contentContainerStyle={{ flex: 1 }}>
                <View style={{ flex: 1, borderRadius: DesignTokens.borderRadius.md, overflow: 'hidden' }}>
                  {renderWebView(heatmapHtml, `heatmap-${heatmapType}`)}
                </View>
              </UICard>
            </View>
          )}

          {activeTab === 'screener' && (
            <View style={{ flex: 1, paddingHorizontal: DesignTokens.spacing.lg, marginBottom: mainTabsHeight - 12 }}>
              {/* Sub-tabs bar like main tabs */}
              <UICard variant="blur" padding="none" style={{ borderRadius: 30, overflow: 'hidden', marginBottom: DesignTokens.spacing.md }}>
                <View style={{ flexDirection: 'row', padding: 4 }}>
                  {[
                    { id: 'stock', label: 'מניות' },
                    { id: 'crypto', label: 'קריפטו' },
                    { id: 'forex', label: 'מט״ח' },
                  ].map((tab) => {
                    const isActive = screenerType === tab.id;
                    return (
                      <TouchableOpacity
                        key={tab.id}
                        onPress={() => setScreenerType(tab.id as any)}
                        activeOpacity={0.7}
                        style={{
                          flex: 1,
                          height: 40,
                          borderRadius: 26,
                          backgroundColor: 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginHorizontal: 2,
                          position: 'relative',
                        }}
                      >
                        {isActive && (
                          <View style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            borderRadius: 26,
                            backgroundColor: `${DesignTokens.colors.primary.main}14`,
                          }} />
                        )}
                        <Text style={{
                          fontSize: DesignTokens.typography.fontSize.sm,
                          fontWeight: isActive ? DesignTokens.typography.fontWeight.bold as any : DesignTokens.typography.fontWeight.medium as any,
                          color: isActive ? DesignTokens.colors.primary.main : DesignTokens.colors.text.secondary,
                          textAlign: 'center',
                        }}>{tab.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </UICard>

              {/* Screener content */}
              <UICard variant="blur" padding="md" style={{ flex: 1, ...DesignTokens.shadows.lg }} contentContainerStyle={{ flex: 1 }}>
                <View style={{ flex: 1, borderRadius: DesignTokens.borderRadius.md, overflow: 'hidden' }}>
                  {renderWebView(screenerHtml, `screener-${screenerType}`)}
                </View>
              </UICard>
            </View>
          )}
          {activeTab === 'feargreed' && (
            <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
              <ScrollView contentContainerStyle={{ paddingHorizontal: DesignTokens.spacing.lg }} showsVerticalScrollIndicator={false}>
                <FearAndGreedCard initialExpanded disableToggle fullWidth />
              </ScrollView>
            </View>
          )}

        </View >
      </RNSafeAreaView >
    </View >
  );
}
