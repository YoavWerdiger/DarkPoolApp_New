/**
 * תשואה כוללת על האחזקה (person + ticker) — מכל העסקאות, לא רק העסקה המוצגת.
 * מחיר ממוצע: קנייה מוסיפה עלות לפי הכמות, מכירה מקטינה את העלות באופן יחסי (כמו בדף פרטי אחזקה).
 *
 * בכיר (Form 4): כמות ומחיר אמיתיים מהדיווח.
 * קונגרס (STOCK Act): אין כמות/מחיר — סכום = אמצע הטווח המדווח, מחיר כניסה = מחיר נוכחי / (1 + שינוי מאז העסקה של Quiver).
 * משוער, ולכן רק כשיש לפחות עסקת קנייה אחת שאפשר לתמחר.
 */
import { getFeedTradeSide } from './feedTradeDisplay';
import { describeInsiderCode } from './insiderTradeDisplay';

interface Lot {
  date: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number;
}

function totalReturnPct(lots: Lot[], currentPrice: number | null | undefined): number | null {
  if (currentPrice == null || !(currentPrice > 0)) return null;
  const sorted = [...lots].sort((a, b) => a.date.localeCompare(b.date));
  let shares = 0;
  let cost = 0;
  for (const lot of sorted) {
    if (!(lot.shares > 0) || !(lot.price > 0)) continue;
    if (lot.side === 'buy') {
      shares += lot.shares;
      cost += lot.shares * lot.price;
    } else if (shares > 0) {
      const sold = Math.min(lot.shares, shares);
      cost *= (shares - sold) / shares;
      shares -= sold;
    }
  }
  if (!(shares > 0) || !(cost > 0)) return null;
  const avg = cost / shares;
  return ((currentPrice - avg) / avg) * 100;
}

export function insiderPositionTotalReturnPct(
  trades: Array<{
    transaction_type?: string | null;
    transaction_date?: string | null;
    shares?: number | null;
    price?: number | null;
  }>,
  currentPrice: number | null | undefined
): number | null {
  const lots: Lot[] = [];
  for (const t of trades) {
    const tone = describeInsiderCode(t.transaction_type).tone;
    if (tone !== 'buy' && tone !== 'sell') continue;
    lots.push({
      date: String(t.transaction_date ?? ''),
      side: tone,
      shares: Math.abs(Number(t.shares) || 0),
      price: Number(t.price) || 0,
    });
  }
  return totalReturnPct(lots, currentPrice);
}

/** «$1,001 - $15,000» / «$50K–$100K» / «$1M+» → אמצע הטווח בדולרים */
export function disclosedAmountMidpoint(label: string | null | undefined): number | null {
  const raw = (label ?? '').replace(/,/g, '');
  const nums = [...raw.matchAll(/\$?\s*(\d+(?:\.\d+)?)\s*([KMB])?/gi)]
    .map((m) => {
      const n = Number(m[1]);
      const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? '').toUpperCase() as 'K' | 'M' | 'B'] ?? 1;
      return n * mult;
    })
    .filter((n) => n > 0);
  if (!nums.length) return null;
  if (nums.length === 1) return nums[0];
  return (nums[0] + nums[1]) / 2;
}

export function congressPositionTotalReturnPct(
  trades: Array<{
    transaction_type?: string | null;
    transaction_date?: string | null;
    amount_label?: string | null;
    price_change_pct?: number | null;
  }>,
  currentPrice: number | null | undefined
): number | null {
  if (currentPrice == null || !(currentPrice > 0)) return null;
  const lots: Lot[] = [];
  for (const t of trades) {
    const usd = disclosedAmountMidpoint(t.amount_label);
    const chg = t.price_change_pct;
    if (usd == null || chg == null || !Number.isFinite(chg) || chg <= -100) continue;
    const entry = currentPrice / (1 + chg / 100);
    if (!(entry > 0)) continue;
    lots.push({
      date: String(t.transaction_date ?? ''),
      side: getFeedTradeSide(t.transaction_type ?? '') === 'sell' ? 'sell' : 'buy',
      shares: usd / entry,
      price: entry,
    });
  }
  return totalReturnPct(lots, currentPrice);
}
