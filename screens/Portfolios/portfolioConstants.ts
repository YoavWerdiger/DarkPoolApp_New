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
};

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

/** טאבים נוספים שמופיעים רק לתיקים מסונכרנים מ-broker */
export const PORTFOLIO_BROKER_TAB = { id: 'broker' as const, label: 'Broker' };

export type PortfolioDetailTab =
  | (typeof PORTFOLIO_DETAIL_TABS)[number]['id']
  | typeof PORTFOLIO_BROKER_TAB['id'];

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
