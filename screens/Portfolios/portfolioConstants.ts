/**
 * קבועים לפיצ'ר תיקי השקעות:
 *  - benchmarks preset
 *  - מטבעות נתמכים
 *  - תוויות עברית לסוגי טרנזקציות, תקופות, מודי טבלה
 */

import type {
  PerformancePeriod,
  TransactionType,
  HoldingsViewMode,
  AssetType,
} from './portfolioTypes';
import type { TextStyle } from 'react-native';

export interface BenchmarkOption {
  symbol: string;
  label: string;
  description: string;
}

/** רשימת benchmarks קבועה - מוצגת ב-CreatePortfolioScreen */
export const BENCHMARK_PRESETS: BenchmarkOption[] = [
  { symbol: 'SPY', label: 'S&P 500 (SPY)', description: '500 החברות הגדולות בארה"ב' },
  { symbol: 'QQQ', label: 'NASDAQ 100 (QQQ)', description: '100 חברות הטכנולוגיה הגדולות' },
  { symbol: 'IWM', label: 'Russell 2000 (IWM)', description: 'חברות קטנות ובינוניות בארה"ב' },
  { symbol: 'DIA', label: 'Dow Jones (DIA)', description: '30 חברות תעשייה גדולות' },
  { symbol: 'VTI', label: 'Total US Market (VTI)', description: 'כל שוק המניות האמריקאי' },
  { symbol: 'BTC-USD', label: 'Bitcoin (BTC-USD)', description: 'מטבע הקריפטו המוביל' },
  { symbol: 'TA35.TA', label: 'תל אביב 35', description: '35 החברות הגדולות בתל אביב' },
];

export const DEFAULT_BENCHMARK = 'SPY';

/** מטבעות תיק נתמכים */
export const SUPPORTED_CURRENCIES = [
  { code: 'USD', label: 'דולר אמריקאי', symbol: '$' },
  { code: 'ILS', label: 'שקל חדש', symbol: '₪' },
  { code: 'EUR', label: 'אירו', symbol: '€' },
  { code: 'GBP', label: 'לירה שטרלינג', symbol: '£' },
] as const;

export const DEFAULT_CURRENCY = 'USD';
export const DEFAULT_RISK_FREE_RATE = 4.0;

/** תוויות עברית לסוגי טרנזקציות */
export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  buy: 'קנייה',
  sell: 'מכירה',
  deposit: 'הפקדה',
  withdrawal: 'משיכה',
  fee: 'מסים ועמלות',
  dividend: 'דיבידנד',
};

/** תוויות עברית לסוגי נכסים */
export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: 'מניה',
  etf: 'ETF',
  fund: 'קרן',
  forex: 'מט"ח',
  crypto: 'קריפטו',
  futures: 'פיוצ\'רס',
};

/** תוויות עברית לסקטורים */
export const SECTOR_LABELS: Record<string, string> = {
  tech: 'טכנולוגיה',
  healthcare: 'בריאות',
  finance: 'פיננסים',
  energy: 'אנרגיה',
  consumer: 'צרכנות',
  industrial: 'תעשייה',
  realestate: 'נדל"ן',
  utilities: 'תשתיות',
  materials: 'חומרי גלם',
  telecom: 'תקשורת',
  crypto: 'קריפטו',
  etf: 'ETF',
  fund: 'קרן',
  forex: 'מט"ח',
  israel: 'מניות ישראל',
  other: 'אחר',
};

/**
 * מיפוי symbol → sector.
 * מכסה את הסמלים הנפוצים ביותר בשוק האמריקאי + ישראל + קריפטו.
 * מוגדר כ-Map (ולא כ-object literal גדול) כדי למנוע stack-overflow ב-tsc.
 */
function buildSectorMap(): Map<string, string> {
  const m = new Map<string, string>();
  const add = (sector: string, ...syms: string[]) => {
    for (const s of syms) m.set(s, sector);
  };
  // Tech
  add('tech',
    'AAPL','MSFT','GOOGL','GOOG','META','NVDA','AMD','INTC','QCOM','AVGO',
    'TXN','MU','AMAT','LRCX','KLAC','MRVL','ADI','MCHP','NXPI','ON','TSM',
    'CRM','ORCL','SAP','IBM','HPE','HPQ','DELL','CSCO','ANET','PANW','FTNT',
    'CRWD','ZS','OKTA','NET','DDOG','SNOW','PLTR','ABNB','UBER','LYFT','DASH',
    'PINS','SNAP','SPOT','NFLX','AMZN','SHOP','INTU','ADSK','ANSS','CDNS',
    'VEEV','WDAY','NOW','TWLO','ZM','DOCU','BOX','GTLB','DSGX','HUBS','SMAR',
    'COUP','MNDY','GLBE','WIX','FROG','RSKD','NICE','CHKP','CYBR','RDWR',
    'KLAR','EBAY','ETSY','WISH',
  );
  // Healthcare
  add('healthcare',
    'JNJ','PFE','MRK','ABBV','BMY','LLY','AMGN','GILD','BIIB','REGN','VRTX',
    'MRNA','BNTX','ISRG','MDT','SYK','BSX','EW','DXCM','TDOC','CVS','UNH',
    'HUM','CI','TMO','DHR','ILMN','ZBH','BAX','BDX','HOLX','IDXX','A','PKI',
    'RGEN','TECH',
  );
  // Finance
  add('finance',
    'JPM','BAC','WFC','C','GS','MS','BK','STT','SCHW','AXP','BLK','BX','APO',
    'KKR','CG','TROW','USB','PNC','TFC','FITB','KEY','CFG','RF','HBAN','MTB',
    'ZION','COIN','HOOD','SQ','PYPL','V','MA','MSCI','SPGI','MCO','ICE','CME',
    'CBOE','NDAQ','FDS',
  );
  // Energy
  add('energy',
    'XOM','CVX','COP','EOG','PXD','DVN','MRO','APA','OXY','SLB','HAL','BKR',
    'VLO','MPC','PSX','HES','WMB','KMI','OKE','ENB','BP','SHEL','TTE','PBR',
  );
  // Consumer
  add('consumer',
    'WMT','TGT','COST','HD','LOW','TJX','ROST','DG','DLTR','NKE','LULU','PG',
    'KO','PEP','MCD','SBUX','YUM','CMG','QSR','DPZ','MO','PM','BTI','MNST',
    'CL','KMB','KHC','GIS','K','SJM','HSY','MDLZ','EL','ULTA','FL','GPS',
  );
  // Industrial
  add('industrial',
    'BA','GE','MMM','CAT','DE','HON','RTX','LMT','NOC','GD','LHX','HII','UPS',
    'FDX','DAL','UAL','AAL','LUV','JBHT','CNI','CSX','UNP','NSC','EMR','ETN',
    'PH','ROK','AME',
  );
  // Real Estate
  add('realestate',
    'SPG','O','PLD','AMT','CCI','EQIX','DLR','VTR','WELL','AVB','EQR','ESS',
    'PSA','EXR','CBRE','JLL',
  );
  // Utilities
  add('utilities',
    'NEE','DUK','SO','D','AEP','EXC','XEL','WEC','ES','AWK','PCG','SRE',
  );
  // Materials
  add('materials',
    'LIN','APD','NEM','FCX','NUE','STLD','X','AA','ALB','SQM','MP','VALE',
    'BHP','RIO','GOLD','AEM',
  );
  // Telecom / Media
  add('telecom',
    'T','VZ','TMUS','CMCSA','CHTR','DISH','LUMN','ATUS','AMX','NTES','WBD',
    'DIS','PARA','FOXA',
  );
  return m;
}

export const SYMBOL_SECTOR_MAP: Map<string, string> = buildSectorMap();

/** תקופות ביצועים (Performance) */
export const PERFORMANCE_PERIODS: { id: PerformancePeriod; label: string }[] = [
  { id: '1W', label: '1 שבוע' },
  { id: '1M', label: '1 חודש' },
  { id: '3M', label: '3 חודשים' },
  { id: 'YTD', label: 'מתחילת השנה' },
  { id: '1Y', label: '1 שנה' },
  { id: '5Y', label: '5 שנים' },
  { id: 'All', label: 'הכל' },
];

/** מודי טבלת Holdings */
export const HOLDINGS_VIEW_MODES: { id: HoldingsViewMode; label: string }[] = [
  { id: 'position', label: 'פוזיציה' },
  { id: 'price', label: 'מחיר' },
  { id: 'financials', label: 'פיננסים' },
  { id: 'performance', label: 'ביצועים' },
  { id: 'risk', label: 'סיכון' },
  { id: 'technicals', label: 'טכני' },
];

/** סדר מימין לשמאל — האיבר הראשון מופיע בקצה הימני */
export const PORTFOLIO_DETAIL_TABS = [
  { id: 'overview' as const,    label: 'סקירה'            },
  { id: 'open_trades' as const, label: 'פוזיציות פתוחות'  },
  { id: 'calendar' as const,    label: 'לוח שנה'          },
  { id: 'transactions' as const, label: 'עסקאות'          },
];

export type PortfolioDetailTab =
  (typeof PORTFOLIO_DETAIL_TABS)[number]['id'];

/**
 * Inactive tab label in PortfolioDetailScreen (tabText) — e.g. "פוזיציות פתוחות".
 * Color: tokens.colors.text.secondary (dark: rgba(255,255,255,0.70)).
 */
export function portfolioDetailTabLabelStyle(textSecondary: string): TextStyle {
  return {
    fontSize: 13,
    fontWeight: '600',
    color: textSecondary,
  };
}

/** מספר ימים שמייצגים תקופה (לחישוב Performance) */
export const PERIOD_TO_DAYS: Record<PerformancePeriod, number | null> = {
  '1W': 7,
  '1M': 30,
  '3M': 91,
  YTD: -1,
  '1Y': 365,
  '5Y': 365 * 5,
  All: null,
};

/** משך תקפות quote ב-cache (במילישניות) - 5 דקות בשעת מסחר */
export const QUOTE_CACHE_TTL_MS = 5 * 60 * 1000;
/** משך תקפות מחיר היסטורי - 12 שעות (אין שינוי בעבר) */
export const HISTORICAL_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/** צבעים ל-distribution chart (סלייסים) */
export const DISTRIBUTION_PALETTE = [
  '#00C805',
  '#3B82F6',
  '#FFB800',
  '#FF4444',
  '#34D399',
  '#A855F7',
  '#EC4899',
  '#06B6D4',
  '#F59E0B',
  '#10B981',
];

/** מספר תיקים מקסימלי – לעת עתה ללא הגבלה. */
export const MAX_PORTFOLIOS_PER_USER = Infinity;
