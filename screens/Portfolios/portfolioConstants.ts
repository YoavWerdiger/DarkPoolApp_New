import { ROOT_DIR } from '../../lib/i18n/direction';
import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
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
  DistributionGroupBy,
} from './portfolioTypes';
import type { TextStyle } from 'react-native';

export interface BenchmarkOption {
  symbol: string;
  label: string;
  description: string;
}

/** רשימת benchmarks קבועה - מוצגת ב-CreatePortfolioScreen */
export const BENCHMARK_PRESETS: BenchmarkOption[] = [
  { symbol: 'SPY', label: 'S&P 500 (SPY)', description: i18n.t('auto.screens__Portfolios__portfolioConstants.s1') },
  { symbol: 'QQQ', label: 'NASDAQ 100 (QQQ)', description: i18n.t('auto.screens__Portfolios__portfolioConstants.s2') },
  { symbol: 'IWM', label: 'Russell 2000 (IWM)', description: i18n.t('auto.screens__Portfolios__portfolioConstants.s3') },
  { symbol: 'DIA', label: 'Dow Jones (DIA)', description: i18n.t('auto.screens__Portfolios__portfolioConstants.s4') },
  { symbol: 'VTI', label: 'Total US Market (VTI)', description: i18n.t('auto.screens__Portfolios__portfolioConstants.s5') },
  { symbol: 'BTC-USD', label: 'Bitcoin (BTC-USD)', description: i18n.t('auto.screens__Portfolios__portfolioConstants.s6') },
  { symbol: 'TA35.TA', label: i18n.t('auto.screens__Portfolios__portfolioConstants.s7'), description: i18n.t('auto.screens__Portfolios__portfolioConstants.s8') },
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
  buy: i18n.t('auto.screens__Portfolios__portfolioConstants.s9'),
  sell: i18n.t('auto.screens__Portfolios__portfolioConstants.s10'),
  deposit: i18n.t('auto.screens__Portfolios__portfolioConstants.s11'),
  withdrawal: i18n.t('auto.screens__Portfolios__portfolioConstants.s12'),
  fee: i18n.t('auto.screens__Portfolios__portfolioConstants.s13'),
  dividend: i18n.t('auto.screens__Portfolios__portfolioConstants.s14'),
};

/** תוויות עברית לסוגי נכסים */
export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: i18n.t('auto.screens__Portfolios__portfolioConstants.s15'),
  etf: 'ETF',
  fund: i18n.t('auto.screens__Portfolios__portfolioConstants.s16'),
  forex: i18n.t('auto.screens__Portfolios__portfolioConstants.s17'),
  crypto: i18n.t('auto.screens__Portfolios__portfolioConstants.s18'),
  futures: i18n.t('auto.screens__Portfolios__portfolioConstants.s19'),
};

/** תוויות עברית לסקטורים */
export const SECTOR_LABELS: Record<string, string> = {
  tech: i18n.t('auto.screens__Portfolios__portfolioConstants.s20'),
  healthcare: i18n.t('auto.screens__Portfolios__portfolioConstants.s21'),
  finance: i18n.t('auto.screens__Portfolios__portfolioConstants.s22'),
  energy: i18n.t('auto.screens__Portfolios__portfolioConstants.s23'),
  consumer: i18n.t('auto.screens__Portfolios__portfolioConstants.s24'),
  industrial: i18n.t('auto.screens__Portfolios__portfolioConstants.s25'),
  realestate: i18n.t('auto.screens__Portfolios__portfolioConstants.s26'),
  utilities: i18n.t('auto.screens__Portfolios__portfolioConstants.s27'),
  materials: i18n.t('auto.screens__Portfolios__portfolioConstants.s28'),
  telecom: i18n.t('auto.screens__Portfolios__portfolioConstants.s29'),
  crypto: i18n.t('auto.screens__Portfolios__portfolioConstants.s18'),
  etf: 'ETF',
  fund: i18n.t('auto.screens__Portfolios__portfolioConstants.s16'),
  forex: i18n.t('auto.screens__Portfolios__portfolioConstants.s17'),
  israel: i18n.t('auto.screens__Portfolios__portfolioConstants.s30'),
  other: i18n.t('auto.screens__Portfolios__portfolioConstants.s31'),
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
  { id: '1W', label: i18n.t('auto.screens__Portfolios__portfolioConstants.s32') },
  { id: '1M', label: i18n.t('auto.screens__Portfolios__portfolioConstants.s33') },
  { id: '3M', label: i18n.t('auto.screens__Portfolios__portfolioConstants.s34') },
  { id: 'YTD', label: i18n.t('auto.screens__Portfolios__portfolioConstants.s35') },
  { id: '1Y', label: i18n.t('auto.screens__Portfolios__portfolioConstants.s36') },
  { id: '5Y', label: i18n.t('auto.screens__Portfolios__portfolioConstants.s37') },
  { id: 'All', label: i18n.t('auto.screens__Portfolios__portfolioConstants.s38') },
];

/** מודי טבלת Holdings */
export const HOLDINGS_VIEW_MODES: { id: HoldingsViewMode; label: string }[] = [
  { id: 'position', label: i18n.t('auto.screens__Portfolios__portfolioConstants.s39') },
  { id: 'price', label: i18n.t('auto.screens__Portfolios__portfolioConstants.s40') },
  { id: 'financials', label: i18n.t('auto.screens__Portfolios__portfolioConstants.s22') },
  { id: 'performance', label: i18n.t('auto.screens__Portfolios__portfolioConstants.s41') },
  { id: 'risk', label: i18n.t('auto.screens__Portfolios__portfolioConstants.s42') },
  { id: 'technicals', label: i18n.t('auto.screens__Portfolios__portfolioConstants.s43') },
];

/** סדר מימין לשמאל — האיבר הראשון מופיע בקצה הימני */
export const PORTFOLIO_DETAIL_TABS = [
  { id: 'overview' as const,    label: i18n.t('auto.screens__Portfolios__portfolioConstants.s44')            },
  { id: 'open_trades' as const, label: i18n.t('auto.screens__Portfolios__portfolioConstants.s45')  },
  { id: 'calendar' as const,    label: i18n.t('auto.screens__Portfolios__portfolioConstants.s46')          },
  { id: 'transactions' as const, label: i18n.t('auto.screens__Portfolios__portfolioConstants.s47')          },
];

export type PortfolioDetailTab =
  (typeof PORTFOLIO_DETAIL_TABS)[number]['id'];

/** קיבוץ חלוקת הנכסים בסקירה — משותף ל-OverviewTab ולסקלטון (אותו סרגל טאבים) */
export const DISTRIBUTION_GROUP_BY_OPTIONS: { id: DistributionGroupBy; label: string }[] = [
  { id: 'symbol', label: i18n.t('auto.screens__Portfolios__tabs__OverviewTab.s1') },
  { id: 'asset_type', label: i18n.t('auto.screens__Portfolios__tabs__OverviewTab.s2') },
  { id: 'sector', label: i18n.t('auto.screens__Portfolios__tabs__OverviewTab.s3') },
  { id: 'currency', label: i18n.t('auto.screens__Portfolios__tabs__OverviewTab.s4') },
];

/**
 * Inactive tab label in PortfolioDetailScreen (tabText) — e.g. "פוזיציות פתוחות".
 * Color: tokens.colors.text.secondary (dark: rgba(255,255,255,0.70)).
 */
export function portfolioDetailTabLabelStyle(textSecondary: string): TextStyle {
  return {
    fontSize: 13,
    fontWeight: '600',
    color: textSecondary,
    writingDirection: TEXT_DIR,
    textAlign: 'right',
    direction: ROOT_DIR,
  };
}

/** מספר ימים שמייצגים תקופה (לחישוב Performance) */
export const PERIOD_TO_DAYS: Record<PerformancePeriod, number | null> = {
  '1D': 1,
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
