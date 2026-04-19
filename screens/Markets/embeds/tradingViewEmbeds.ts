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

export const tabHtmlTemplate = (bodyContent: string, clipBottom: number = 0) => `
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
  ${bodyContent}
</body>
</html>
`;

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

  return tabHtmlTemplate(body);
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

  const body = `
  <div class="tradingview-widget-container">
    <div class="tradingview-widget-container__widget"></div>
    <div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a></div>
    <script type="text/javascript" src="${widgetSrc}" async>
    ${JSON.stringify(config, null, 2)}
    </script>
  </div>
  `;

  return tabHtmlTemplate(body, 48);
}

export function getTradingViewScreenerHTML(type: ScreenerKind) {
  const widgetUrl = 'https://s3.tradingview.com/external-embedding/embed-widget-screener.js';

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

  const body = `
  <div class="tradingview-widget-container">
    <div class="tradingview-widget-container__widget"></div>
    <div class="tradingview-widget-copyright"><a href="https://il.tradingview.com/markets/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a></div>
    <script type="text/javascript" src="${widgetUrl}" async>
    ${JSON.stringify(config, null, 2)}
    </script>
  </div>
  `;

  return tabHtmlTemplate(body, 48);
}
