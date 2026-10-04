import type { SymbolSearchResult } from './portfolioPriceFeed';
import type { AssetType } from '../../screens/Portfolios/portfolioTypes';

/** סיומות בורסות זרות / listings כפולים — לא רלוונטי לרוב משתמשי האפליקציה */
const FOREIGN_SUFFIX_RE =
  /\.(TO|V|NE|CN|L|AS|PA|DE|F|BE|MU|HA|STU|MI|BR|LS|MC|SW|VX|ST|HE|OL|CO|IC|IR|WA|PR|RO|BG|AT|TA|HK|T|SS|SZ|KS|KQ|AX|NZ|JO|SA|MX|SN|BC|BA|LM|CR|TWO|TW)$/i;

/** סוגי נייר שמעניינים אותנו */
const ALLOWED_TYPES = new Set([
  'common stock',
  'etf',
  // Finnhub מחזיר ETF כ-"ETP"
  'etp',
  'adr',
  'closed-end fund',
  'reit',
  'equity',
  'stock',
]);

/** סוגים שנחסמים במפורש */
const BLOCKED_TYPE_RE =
  /canadian\s*dr|depositary receipt|etn|warrant|right|unit|preferred|bond|note|index|crypto|forex|mutual fund|money market/i;

/**
 * סימבול "נקי" לשוק האמריקאי:
 * AAPL, BRK.B, BF.A — בלי סיומת בורסה זרה.
 */
function isCleanUsSymbol(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  if (!s || s.length > 8) return false;
  if (FOREIGN_SUFFIX_RE.test(s)) return false;
  // אותיות + אופציונלית .CLASS (אות אחת)
  return /^[A-Z]{1,5}(\.[A-Z])?$/.test(s);
}

function isAllowedType(type: string): boolean {
  const t = (type || '').trim().toLowerCase();
  if (!t) return true; // Finnhub לפעמים מחזיר ריק
  if (BLOCKED_TYPE_RE.test(t)) return false;
  if (ALLOWED_TYPES.has(t)) return true;
  // "Common Stock" וכו'
  if (t.includes('common stock')) return true;
  if (t === 'etf' || t === 'etp' || t.includes('exchange traded')) return true;
  if (t === 'adr') return true;
  return false;
}

function rankResult(r: SymbolSearchResult, q: string): number {
  const query = q.trim().toUpperCase();
  const sym = r.symbol.toUpperCase();
  const display = (r.display_symbol || sym).toUpperCase();
  let score = 0;
  if (sym === query || display === query) score += 1000;
  else if (sym.startsWith(query) || display.startsWith(query)) score += 500;
  else if (sym.includes(query)) score += 200;

  const t = (r.type || '').toLowerCase();
  if (t.includes('common stock')) score += 80;
  else if (t === 'etf' || t === 'etp' || t.includes('etf')) score += 40;
  else if (t === 'adr') score += 30;

  // קצרים עדיפים (פחות "זבל")
  score += Math.max(0, 20 - sym.length);
  return score;
}

export type FilterSymbolSearchOptions = {
  /** ברירת מחדל true — רק סימבולים אמריקאים נקיים */
  usPrimaryOnly?: boolean;
  limit?: number;
};

/** מסנן וממיין תוצאות Finnhub — פחות זבל, יותר מניות אמיתיות */
export function filterSymbolSearchResults(
  results: SymbolSearchResult[],
  query: string,
  options: FilterSymbolSearchOptions = {}
): SymbolSearchResult[] {
  const usPrimaryOnly = options.usPrimaryOnly !== false;
  const limit = options.limit ?? 20;

  const filtered = results.filter((r) => {
    if (!r.symbol) return false;
    if (!isAllowedType(r.type)) return false;
    if (usPrimaryOnly && !isCleanUsSymbol(r.symbol)) return false;
    return true;
  });

  filtered.sort((a, b) => rankResult(b, query) - rankResult(a, query));

  // דה-דופ לפי symbol
  const seen = new Set<string>();
  const unique: SymbolSearchResult[] = [];
  for (const r of filtered) {
    const key = r.symbol.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
    if (unique.length >= limit) break;
  }
  return unique;
}

/** תווית עברית קצרה לסוג נייר */
export function hebrewAssetTypeLabel(type: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('common stock') || t === 'equity' || t === 'stock') return 'מניה';
  if (t === 'crypto') return 'קריפטו';
  if (t.includes('etf') || t === 'etp' || t.includes('exchange traded')) return 'ETF';
  if (t === 'adr') return 'ADR';
  if (t.includes('reit')) return 'REIT';
  if (t.includes('closed-end')) return 'קרן';
  return 'מניה';
}

/** סוג נכס לפוזיציה לפי סוג הנייר מהחיפוש — המשתמש עדיין יכול לשנות ידנית */
export function assetTypeFromSearchType(type: string): AssetType {
  const t = (type || '').toLowerCase();
  if (t === 'crypto') return 'crypto';
  if (t === 'etp' || t.includes('etf') || t.includes('exchange traded')) return 'etf';
  if (t.includes('closed-end') || t.includes('fund')) return 'fund';
  return 'stock';
}

/** קריפטו מובילים — Finnhub search לא מחזיר קריפטו; מחיר דרך Yahoo (BTC-USD) */
const CRYPTO_UNIVERSE: Array<{ base: string; name: string }> = [
  { base: 'BTC', name: 'Bitcoin' },
  { base: 'ETH', name: 'Ethereum' },
  { base: 'SOL', name: 'Solana' },
  { base: 'XRP', name: 'XRP' },
  { base: 'BNB', name: 'BNB' },
  { base: 'DOGE', name: 'Dogecoin' },
  { base: 'ADA', name: 'Cardano' },
  { base: 'AVAX', name: 'Avalanche' },
  { base: 'LINK', name: 'Chainlink' },
  { base: 'DOT', name: 'Polkadot' },
  { base: 'LTC', name: 'Litecoin' },
  { base: 'TRX', name: 'TRON' },
  { base: 'MATIC', name: 'Polygon' },
  { base: 'SHIB', name: 'Shiba Inu' },
  { base: 'TON', name: 'Toncoin' },
  { base: 'SUI', name: 'Sui' },
];

export function searchCryptoUniverse(query: string): SymbolSearchResult[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  return CRYPTO_UNIVERSE.filter(
    (c) => c.base.startsWith(q) || c.name.toUpperCase().startsWith(q) || `${c.base}-USD`.startsWith(q),
  )
    .sort((a, b) => Number(b.base === q) - Number(a.base === q))
    .map((c) => ({
      symbol: `${c.base}-USD`,
      description: c.name,
      display_symbol: `${c.base}-USD`,
      type: 'Crypto',
    }));
}
