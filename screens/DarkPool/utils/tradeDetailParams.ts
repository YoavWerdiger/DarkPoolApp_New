/**
 * פרמטרי מסך פרטי עסקה — שני סוגי דיווח בלבד, בלי נפילה לפרופיל.
 *
 * הפיד החי (טאב פיד) מציג קונגרס + Form 4. 13F / דלתא רבעונית אינם עסקה
 * ואין להם שורת פיד — אל תמציאו פרטי עסקה בשבילם.
 *
 * כל builder מחזיר אובייקט JSON-serializable בלבד (ל-native stack).
 * מחיר/מניות/סטרייק שלא קיימים במקור נשארים חסרים — לא 0 מזויף ב-UI.
 */

import type { CongressFeedTrade } from '../../../services/darkpool/uwCongressFeedService';
import type { FollowingActivityItem } from '../../../services/darkpool/uwFollowingFeedService';
import type { InvestorRecentTrade } from '../../../services/darkpool/uwInvestorProfileService';
import type { InsiderBuyRow } from '../../../types/darkpool.types';

export type DarkPoolTradeDetailParams =
  | { kind: 'congress'; trade: CongressFeedTrade }
  | { kind: 'insider'; trade: InsiderBuyRow };

function numOrNull(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function str(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw : raw == null ? fallback : String(raw);
}

function isoDay(raw: unknown): string {
  const s = str(raw).trim();
  if (!s) return '';
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function isSellLabel(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return (
    t === 's' ||
    t === 'sell' ||
    t === 'sale' ||
    t === 'sold' ||
    t.includes('sell') ||
    t.includes('sale') ||
    t.includes('מכר') ||
    t.includes('מכיר')
  );
}

/**
 * פיד מעקב/פרופיל מקוצר לרוב יודע רק «רכישה»/«מכירה», לא את אות Form 4.
 * מכירה → `S` (כן מכירה). רכישה → לא `P`: בלי האות אסור לכתוב «רכישה בשוק».
 */
function insiderCodeFromLabel(raw: string): InsiderBuyRow['transaction_type'] {
  return isSellLabel(raw) ? 'S' : ('BUY' as InsiderBuyRow['transaction_type']);
}

function parseShareCount(raw: string | null | undefined): number {
  if (!raw?.trim()) return 0;
  const m = raw.replace(/,/g, '').match(/([\d.]+)\s*מניות/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function serializeCongressTrade(trade: CongressFeedTrade): CongressFeedTrade {
  return {
    id: str(trade.id),
    politician_id: str(trade.politician_id),
    politician_name: str(trade.politician_name),
    politician_image_url: trade.politician_image_url ?? null,
    ticker: str(trade.ticker).toUpperCase(),
    company_name: trade.company_name ?? null,
    transaction_type: trade.transaction_type === 'sell' ? 'sell' : 'buy',
    shares: null,
    price: null,
    amount_label: trade.amount_label ?? null,
    filed_at: str(trade.filed_at),
    transaction_date: str(trade.transaction_date),
    txn_label: trade.transaction_type === 'sell' ? 'מכירה' : 'רכישה',
    source: trade.source === 'unusualwhales' ? 'unusualwhales' : 'quiverquant',
    excess_return_pct: numOrNull(trade.excess_return_pct),
    price_change_pct: numOrNull(trade.price_change_pct),
    spy_change_pct: numOrNull(trade.spy_change_pct),
  };
}

export function serializeInsiderTrade(trade: InsiderBuyRow): InsiderBuyRow {
  const code = String(trade.transaction_type ?? '')
    .trim()
    .toUpperCase();
  const allowed: InsiderBuyRow['transaction_type'][] = [
    'P',
    'S',
    'A',
    'M',
    'G',
    'F',
    'O',
    'D',
  ];
  const transaction_type = allowed.includes(code as InsiderBuyRow['transaction_type'])
    ? (code as InsiderBuyRow['transaction_type'])
    : insiderCodeFromLabel(code);

  const shares = Number(trade.shares);
  const price = Number(trade.price);
  const value = Number(trade.value);

  return {
    id: str(trade.id),
    external_id: trade.external_id ?? null,
    ticker: str(trade.ticker).toUpperCase(),
    company_name: trade.company_name ?? null,
    insider_cik: trade.insider_cik ?? null,
    insider_logo_url: trade.insider_logo_url ?? null,
    insider_name: trade.insider_name ?? null,
    insider_role: trade.insider_role ?? null,
    transaction_type,
    shares: Number.isFinite(shares) ? shares : 0,
    price: Number.isFinite(price) ? price : 0,
    value: Number.isFinite(value) ? value : 0,
    filed_at: str(trade.filed_at),
    transaction_date: str(trade.transaction_date),
    source: str(trade.source) || 'form4',
    sector: trade.sector ?? null,
    is_sp500: trade.is_sp500 ?? null,
    marketcap: trade.marketcap ?? null,
    next_earnings_date: trade.next_earnings_date ?? null,
    created_at: str(trade.created_at) || str(trade.filed_at),
  };
}

export function congressTradeDetailParams(
  trade: CongressFeedTrade
): DarkPoolTradeDetailParams {
  return { kind: 'congress', trade: serializeCongressTrade(trade) };
}

export function insiderTradeDetailParams(
  trade: InsiderBuyRow
): DarkPoolTradeDetailParams {
  return { kind: 'insider', trade: serializeInsiderTrade(trade) };
}

/**
 * שורת «פעילות אחרונה» במעקב — עסקה מקוצרת.
 * PriceChange לרוב חסר; פרטי העסקה ישלימו «מאז העסקה» מפתיחת יום הביצוע.
 */
export function followingActivityToTradeDetail(
  item: FollowingActivityItem
): DarkPoolTradeDetailParams | null {
  const ticker = str(item.ticker).toUpperCase();
  if (!ticker) return null;
  if (item.source === 'congress') {
    const side = isSellLabel(item.txn_label) ? 'sell' : 'buy';
    const day = isoDay(item.activity_date);
    const traded = isoDay(item.transaction_date) || day;
    const filed = isoDay(item.filed_at) || day;
    return congressTradeDetailParams({
      id: str(item.id),
      politician_id: str(item.person_id),
      politician_name: str(item.person_name) || 'פוליטיקאי',
      politician_image_url: item.person_image_url ?? null,
      ticker,
      company_name: item.issuer ?? null,
      transaction_type: side,
      shares: null,
      price: null,
      amount_label: item.amount_label ?? null,
      filed_at: filed,
      transaction_date: traded,
      txn_label: str(item.txn_label) || (side === 'sell' ? 'מכירה' : 'רכישה'),
      source: 'unusualwhales',
      excess_return_pct: null,
      price_change_pct: numOrNull(item.price_change_pct),
      spy_change_pct: null,
    });
  }
  if (item.source === 'insider') {
    const day = isoDay(item.activity_date);
    const shares = parseShareCount(item.amount_label);
    return insiderTradeDetailParams({
      id: str(item.id),
      external_id: null,
      ticker,
      company_name: item.issuer ?? null,
      insider_cik: null,
      insider_logo_url: item.person_image_url ?? null,
      insider_name: str(item.person_name) || 'בכיר',
      insider_role: null,
      transaction_type: insiderCodeFromLabel(item.txn_label),
      shares,
      price: 0,
      value: 0,
      filed_at: day,
      transaction_date: day,
      source: 'form4',
      created_at: day,
    });
  }
  return null;
}

/**
 * שורת «עסקאות אחרונות» בפרופיל. מנהל קרן (13F) → null — זו דלתא רבעונית.
 */
export function profileRecentToTradeDetail(input: {
  personKind: 'politician' | 'insider' | 'fund_manager';
  personId: string;
  personName: string;
  personImage?: string | null;
  tickerHint?: string;
  row: Pick<InvestorRecentTrade, 'id' | 'ticker' | 'txn_label' | 'amount_label' | 'date'> & {
    traded_date?: string | null;
  };
}): DarkPoolTradeDetailParams | null {
  const { personKind, personId, personName, personImage, tickerHint, row } = input;
  if (personKind === 'fund_manager') return null;
  const ticker = str(row.ticker || tickerHint).toUpperCase();
  if (!ticker) return null;
  const filed = isoDay(row.date);
  const traded = isoDay(row.traded_date) || filed;

  if (personKind === 'politician') {
    const side = isSellLabel(row.txn_label) ? 'sell' : 'buy';
    return congressTradeDetailParams({
      id: str(row.id),
      politician_id: str(personId),
      politician_name: str(personName) || 'פוליטיקאי',
      politician_image_url: personImage ?? null,
      ticker,
      company_name: null,
      transaction_type: side,
      shares: null,
      price: null,
      amount_label: row.amount_label ?? null,
      filed_at: filed,
      transaction_date: traded,
      txn_label: str(row.txn_label) || (side === 'sell' ? 'מכירה' : 'רכישה'),
      source: 'quiverquant',
      excess_return_pct: null,
      price_change_pct: null,
      spy_change_pct: null,
    });
  }

  return insiderTradeDetailParams({
    id: str(row.id),
    external_id: null,
    ticker,
    company_name: null,
    insider_cik: null,
    insider_logo_url: personImage ?? null,
    insider_name: str(personName) || 'בכיר',
    insider_role: null,
    transaction_type: insiderCodeFromLabel(row.txn_label),
    shares: parseShareCount(row.amount_label),
    price: 0,
    value: 0,
    filed_at: filed,
    transaction_date: traded,
    source: 'form4',
    created_at: filed,
  });
}

export function hasTradeDetailPayload(
  params: DarkPoolTradeDetailParams | null | undefined
): params is DarkPoolTradeDetailParams {
  if (!params) return false;
  if (params.kind === 'congress') {
    return Boolean(params.trade?.id || params.trade?.ticker);
  }
  if (params.kind === 'insider') {
    return Boolean(params.trade?.id || params.trade?.ticker);
  }
  return false;
}
