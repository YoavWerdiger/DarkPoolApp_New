/**
 * פעילות המסחר של טראמפ (OGE 278-T דרך Quiver/UW) — מה שבאמת מדווח.
 * אין «שווי תיק»: הדיווח הוא עסקאות בטווחי סכום מאז 2026, בלי יתרת פתיחה —
 * שחזור תיק מהן מתחיל מאפס ומתעלם ממכירות של אחזקות קודמות. כאן רק סיכומי פעילות.
 */
import type { CongressTradeInput } from './congressPortfolio.ts';

export interface AmountRange {
  low: number;
  high: number;
}

export interface TrumpTickerActivity {
  ticker: string;
  buys: number;
  sells: number;
  buy: AmountRange;
  sell: AmountRange;
  last_date: string;
  last_side: 'buy' | 'sell';
}

export interface TrumpMonthActivity {
  month: string; // YYYY-MM
  buys: number;
  sells: number;
  buy: AmountRange;
  sell: AmountRange;
}

export interface TrumpActivitySummary {
  from: string;
  to: string;
  trade_count: number;
  buys: number;
  sells: number;
  tickers: number;
  buy: AmountRange;
  sell: AmountRange;
  monthly: TrumpMonthActivity[];
  /** לפי אמצע טווח הקנייה */
  top_bought: TrumpTickerActivity[];
  top_sold: TrumpTickerActivity[];
  /** הכי הרבה עסקאות */
  most_active: TrumpTickerActivity[];
}

/** "$1,001 - $15,000" / "Over $50,000,000" → טווח */
export function parseAmountRange(label?: string | null): AmountRange | null {
  const s = String(label ?? '');
  const nums = (s.match(/\d[\d,]*/g) ?? []).map((n) => Number(n.replace(/,/g, ''))).filter((n) => n > 0);
  if (!nums.length) return null;
  if (nums.length === 1) {
    const n = nums[0];
    return /over|\+|more/i.test(s) ? { low: n, high: n } : { low: n, high: n };
  }
  return { low: Math.min(nums[0], nums[1]), high: Math.max(nums[0], nums[1]) };
}

function sideOf(t: CongressTradeInput): 'buy' | 'sell' | null {
  const x = String(t.txn_type ?? '').toLowerCase();
  if (x.includes('sale') || x.includes('sell')) return 'sell';
  if (x.includes('purch') || x.includes('buy')) return 'buy';
  return null;
}

const add = (a: AmountRange, b: AmountRange) => {
  a.low += b.low;
  a.high += b.high;
};
const mid = (r: AmountRange) => (r.low + r.high) / 2;

export function buildTrumpActivity(inputs: CongressTradeInput[]): TrumpActivitySummary | null {
  const byTicker = new Map<string, TrumpTickerActivity>();
  const byMonth = new Map<string, TrumpMonthActivity>();
  const total = { buy: { low: 0, high: 0 }, sell: { low: 0, high: 0 } };
  let buys = 0;
  let sells = 0;
  let from = '';
  let to = '';

  for (const t of inputs) {
    const side = sideOf(t);
    const range = parseAmountRange(t.amounts);
    const ticker = String(t.ticker ?? '').toUpperCase().trim();
    const day = String(t.transaction_date ?? '').slice(0, 10);
    if (!side || !range || !ticker || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (!from || day < from) from = day;
    if (!to || day > to) to = day;

    const tk = byTicker.get(ticker) ?? {
      ticker,
      buys: 0,
      sells: 0,
      buy: { low: 0, high: 0 },
      sell: { low: 0, high: 0 },
      last_date: day,
      last_side: side,
    };
    const m = day.slice(0, 7);
    const mo = byMonth.get(m) ?? { month: m, buys: 0, sells: 0, buy: { low: 0, high: 0 }, sell: { low: 0, high: 0 } };
    if (side === 'buy') {
      buys++;
      tk.buys++;
      mo.buys++;
      add(tk.buy, range);
      add(mo.buy, range);
      add(total.buy, range);
    } else {
      sells++;
      tk.sells++;
      mo.sells++;
      add(tk.sell, range);
      add(mo.sell, range);
      add(total.sell, range);
    }
    if (day >= tk.last_date) {
      tk.last_date = day;
      tk.last_side = side;
    }
    byTicker.set(ticker, tk);
    byMonth.set(m, mo);
  }

  if (!buys && !sells) return null;
  const list = Array.from(byTicker.values());
  return {
    from,
    to,
    trade_count: buys + sells,
    buys,
    sells,
    tickers: list.length,
    buy: total.buy,
    sell: total.sell,
    monthly: Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)),
    top_bought: list.filter((x) => x.buys > 0).sort((a, b) => mid(b.buy) - mid(a.buy)).slice(0, 15),
    top_sold: list.filter((x) => x.sells > 0).sort((a, b) => mid(b.sell) - mid(a.sell)).slice(0, 15),
    most_active: [...list].sort((a, b) => b.buys + b.sells - (a.buys + a.sells)).slice(0, 15),
  };
}
