import { useDesignTokens } from '../../../components/ui/DesignTokens';

export type MarketsTokens = ReturnType<typeof useDesignTokens>;

export type HeatmapKind = 'sp500' | 'crypto' | 'nasdaq';
export type ScreenerKind = 'sp500' | 'nasdaq' | 'crypto';

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

/**
 * תבנית HTML אחידה לווידג'טים של TradingView.
 *
 * הזרקה ידנית של תג <script> חיוניות ב-iOS WKWebView: סקריפטי ה-embed
 * החיצוניים של TradingView קוראים את ה-config מתוך textContent של ה-script
 * שהם מצורפים אליו. כשמשתמשים ב-<script src async> עם תוכן inline ישירות
 * ב-HTML הראשוני, document.currentScript עלול להיות null ב-WebKit וה-config
 * לא נטען — וכתוצאה מכך הווידג'ט לא מאותחל. הזרקה דרך appendChild מבטיחה
 * שגם ב-iOS, גם ב-Android וגם בדפדפנים רגילים ה-script ייטען עם ה-config.
 */
export const tvWidgetHtml = (
  widgetSrc: string,
  config: Record<string, unknown>,
  clipBottom: number = 0
) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
      background-color: transparent;
      overflow: hidden;
      -webkit-overflow-scrolling: touch;
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
      overflow: hidden;
      position: relative;
    }
    .tradingview-widget-container__widget iframe,
    .tradingview-widget-container__widget > div {
      width: 100% !important;
      height: ${clipBottom > 0 ? `calc(100% + ${clipBottom}px)` : '100%'} !important;
      border: none !important;
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
    <script type="application/json" id="tv-config">${JSON.stringify(config)}</script>
    <script>
      (function () {
        try {
          var cfg = document.getElementById('tv-config').textContent;
          var s = document.createElement('script');
          s.type = 'text/javascript';
          s.src = ${JSON.stringify(widgetSrc)};
          s.async = true;
          s.text = cfg;
          var container = document.querySelector('.tradingview-widget-container');
          container.appendChild(s);
        } catch (err) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage('tv-init-error: ' + (err && err.message ? err.message : err));
          }
        }
      })();
    </script>
</body>
</html>
`;

/**
 * Ticker Tape — רצועת סמלים נעה דקה ומינימלית בראש דף השווקים.
 * גובה מומלץ: ~44px במצב compact.
 */
export function getTradingViewTickerTapeHTML(tokens: MarketsTokens) {
  const config = {
    symbols: [
      { proName: 'FOREXCOM:SPXUSD', title: 'S&P 500' },
      { proName: 'FOREXCOM:NSXUSD', title: 'Nasdaq 100' },
      { proName: 'FOREXCOM:DJI', title: 'Dow Jones' },
      { proName: 'CAPITALCOM:RTY', title: 'Russell 2000' },
      { proName: 'CBOE:VIX', title: 'VIX' },
      { proName: 'BINANCE:BTCUSDT', title: 'Bitcoin' },
      { proName: 'BINANCE:ETHUSDT', title: 'Ethereum' },
      { proName: 'OANDA:XAUUSD', title: 'Gold' },
      { proName: 'TVC:SILVER', title: 'Silver' },
      { proName: 'MATBAROFEX:WTI1!', title: 'WTI Oil' },
      { proName: 'OANDA:EURUSD', title: 'EUR/USD' },
      { proName: 'OANDA:USDJPY', title: 'USD/JPY' },
      { proName: 'TVC:US10Y', title: 'US 10Y' },
      { proName: 'TVC:DXY', title: 'DXY' },
    ],
    showSymbolLogo: true,
    isTransparent: true,
    displayMode: 'compact',
    colorTheme: 'dark',
    locale: 'he_IL',
  };

  return tvWidgetHtml(
    'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js',
    config,
    32
  );
}

export function getTradingViewMarketOverviewHTML(tokens: MarketsTokens) {
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
    scaleFontColor: tokens.colors.text.secondary,
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
          { s: 'AMEX:SPY', d: 'SPY ETF (S&P 500)' },
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

  return tvWidgetHtml(
    'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js',
    config,
    0
  );
}

/**
 * Hot Lists — מציג Top Gainers / Top Losers / Most Active באותו הווידג'ט,
 * בטאבים פנימיים. מתאים לכרטיס "מי זז בשוק" מתחת למדדים והחוזים.
 */
export function getTradingViewHotListsHTML(tokens: MarketsTokens) {
  const config = {
    colorTheme: 'dark',
    dateRange: '1D',
    exchange: 'US',
    showChart: true,
    locale: 'he_IL',
    largeChartUrl: '',
    isTransparent: true,
    showSymbolLogo: true,
    showFloatingTooltip: false,
    width: '100%',
    height: '100%',
    plotLineColorGrowing: hexToRgba(tokens.colors.primary.main, 1),
    plotLineColorFalling: hexToRgba(tokens.colors.danger?.main || tokens.colors.text.danger, 1),
    gridLineColor: 'rgba(240, 243, 250, 0)',
    scaleFontColor: tokens.colors.text.secondary,
    belowLineFillColorGrowing: hexToRgba(tokens.colors.primary.main, 0.12),
    belowLineFillColorFalling: hexToRgba(tokens.colors.danger?.main || tokens.colors.text.danger, 0.12),
    belowLineFillColorGrowingBottom: hexToRgba(tokens.colors.primary.main, 0),
    belowLineFillColorFallingBottom: hexToRgba(tokens.colors.danger?.main || tokens.colors.text.danger, 0),
    symbolActiveColor: hexToRgba(tokens.colors.primary.main, 0.12),
  };

  return tvWidgetHtml(
    'https://s3.tradingview.com/external-embedding/embed-widget-hotlists.js',
    config,
    0
  );
}

export function getTradingViewHeatmapHTML(type: HeatmapKind) {
  let widgetSrc = '';
  let config: Record<string, unknown> = {};

  if (type === 'crypto') {
    widgetSrc = 'https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js';
    config = {
      dataSource: 'Crypto',
      blockSize: 'market_cap_calc',
      blockColor: '24h_close_change|5',
      locale: 'he_IL',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: '100%',
      height: '100%',
    };
  } else if (type === 'nasdaq') {
    widgetSrc = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
    config = {
      dataSource: 'NASDAQCOMPOSITE',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      grouping: 'sector',
      locale: 'he_IL',
      symbolUrl: '',
      colorTheme: 'dark',
      exchanges: [],
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: '100%',
      height: '100%',
    };
  } else {
    widgetSrc = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
    config = {
      dataSource: 'SPX500',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      grouping: 'sector',
      locale: 'he_IL',
      symbolUrl: '',
      colorTheme: 'dark',
      exchanges: [],
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: '100%',
      height: '100%',
    };
  }

  return tvWidgetHtml(widgetSrc, config, 48);
}

/**
 * Advanced Chart for a specific symbol — used in Trade Detail.
 * interval is auto-calculated from trade duration.
 */
export function getTradingViewTradeChartHTML(symbol: string, entryDate: string, exitDate: string) {
  const entryMs = new Date(entryDate).getTime();
  const exitMs = new Date(exitDate).getTime();
  const durationMs = Math.max(exitMs - entryMs, 0);
  const durationDays = durationMs / 86400000;

  let interval: string;
  if (durationDays < 0.5) {
    interval = '5';
  } else if (durationDays < 2) {
    interval = '15';
  } else if (durationDays < 14) {
    interval = '60';
  } else if (durationDays < 90) {
    interval = 'D';
  } else {
    interval = 'W';
  }

  const config = {
    autosize: true,
    symbol,
    interval,
    timezone: 'America/New_York',
    theme: 'dark',
    style: '1',
    locale: 'en',
    backgroundColor: 'rgba(10, 14, 10, 0)',
    gridColor: 'rgba(255,255,255,0.05)',
    enable_publishing: false,
    hide_top_toolbar: true,
    hide_legend: false,
    save_image: false,
    calendar: false,
    hide_volume: false,
    support_host: 'https://www.tradingview.com',
    width: '100%',
    height: '100%',
  };

  return tvWidgetHtml(
    'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js',
    config,
    0
  );
}

export function getTradingViewScreenerHTML(type: ScreenerKind) {
  const widgetSrc = 'https://s3.tradingview.com/external-embedding/embed-widget-screener.js';

  let config: Record<string, unknown> = {};

  switch (type) {
    case 'sp500':
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
    case 'nasdaq':
      config = {
        market: 'america',
        showToolbar: true,
        defaultColumn: 'overview',
        defaultScreen: 'nasdaq',
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
  }

  return tvWidgetHtml(widgetSrc, config, 48);
}
