/**
 * portfolioCalc.ts
 * --------------------------------------------------------------------------
 * ספריית חישובים פיננסיים נטולת תלויות (Pure TypeScript).
 *
 * מיועדת לרוץ גם ב-React Native (client) וגם ב-Supabase Edge Functions (Deno).
 * ללא תלות ב-React/Supabase – רק חישובים טהורים על מבני נתונים.
 *
 * חישובים מרכזיים:
 *   - calculateFifoPosition: avg_price + realized_gain פר-symbol עם FIFO lots
 *   - xirr: קצב תשואה שנתי (Annualized Yield) על פי תזרים מזומנים
 *   - sharpeRatio / sortinoRatio: יחסי תשואה-סיכון
 *   - beta: רגישות תיק ל-benchmark
 *   - volatility: סטיית תקן שנתית של תשואות יומיות
 *   - performanceForPeriod: תשואת תיק על פני תקופה
 */

// ----------------------------------------------------------------------------
// Types פנימיים
// ----------------------------------------------------------------------------

export interface FifoTransaction {
  type: 'buy' | 'sell';
  date: string; // ISO
  quantity: number;
  price: number;
  commission?: number;
}

export interface FifoResult {
  /** כמות פתוחה (long) - תמיד >= 0 */
  open_quantity: number;
  /** עלות ממוצעת של הלוטים הפתוחים, כולל עמלות */
  avg_price: number;
  /** סכום עלות הפוזיציה הפתוחה (avg * qty + commissions allocated) */
  invested: number;
  /** רווח/הפסד ממומש מסך כל המכירות */
  realized_gain: number;
  /** כמות שנקנתה סה"כ */
  total_bought: number;
  /** כמות שנמכרה סה"כ */
  total_sold: number;
  /** האם הפוזיציה סגורה כעת */
  is_closed: boolean;
}

export interface CashFlowEntry {
  date: string; // ISO
  amount: number; // שלילי = יציאה (קנייה/הפקדה), חיובי = כניסה (מכירה/דיבידנד)
}

export interface PricePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

// ----------------------------------------------------------------------------
// FIFO – חישוב פוזיציה לפי שיטת First-In-First-Out
// ----------------------------------------------------------------------------

interface FifoLot {
  quantity: number;
  unitCost: number; // מחיר ליחידה כולל עמלה מחולקת
}

/**
 * מקבל רשימת טרנזקציות buy/sell של נכס יחיד (ממוינות לפי תאריך עולה)
 * ומחזיר חישוב FIFO מלא: avg_price לעדיין-פתוחות + realized_gain.
 */
export function calculateFifoPosition(
  transactions: FifoTransaction[]
): FifoResult {
  const sorted = [...transactions].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );

  const lots: FifoLot[] = [];
  let realizedGain = 0;
  let totalBought = 0;
  let totalSold = 0;

  for (const tx of sorted) {
    const commission = tx.commission ?? 0;

    if (tx.type === 'buy') {
      const quantity = tx.quantity;
      if (quantity <= 0) continue;
      // distribute commission across the bought quantity
      const unitCost = tx.price + commission / quantity;
      lots.push({ quantity, unitCost });
      totalBought += quantity;
    } else {
      // sell – consume FIFO lots
      let qtyToSell = tx.quantity;
      if (qtyToSell <= 0) continue;
      const grossSell = tx.price * tx.quantity - commission;
      let costOfSold = 0;
      let qtySold = 0;

      while (qtyToSell > 0 && lots.length > 0) {
        const lot = lots[0];
        const take = Math.min(lot.quantity, qtyToSell);
        costOfSold += take * lot.unitCost;
        qtySold += take;
        lot.quantity -= take;
        qtyToSell -= take;
        if (lot.quantity <= 1e-12) lots.shift();
      }

      // אם נמכר יותר מהקיים – שאר ה-qty נחשב לפוזיציה שלילית בלי lot
      // (מתעדים אבל לא מחזיקים lot שלילי כדי לשמור על אינווריאנט long-only)
      if (qtyToSell > 0) {
        // Treat as short (לא נתמך - מתועד אך לא נכלל ב-realized)
        qtySold += qtyToSell;
      }

      const proceedsForSold =
        qtySold > 0 ? (grossSell * qtySold) / tx.quantity : 0;
      realizedGain += proceedsForSold - costOfSold;
      totalSold += tx.quantity;
    }
  }

  const openQuantity = lots.reduce((sum, l) => sum + l.quantity, 0);
  const invested = lots.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
  const avgPrice = openQuantity > 0 ? invested / openQuantity : 0;

  return {
    open_quantity: openQuantity,
    avg_price: avgPrice,
    invested,
    realized_gain: realizedGain,
    total_bought: totalBought,
    total_sold: totalSold,
    is_closed: openQuantity <= 1e-9,
  };
}

// ----------------------------------------------------------------------------
// XIRR – Internal Rate of Return for irregular cash flows
// (Annualized Yield)
// ----------------------------------------------------------------------------

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

function npv(rate: number, cashflows: CashFlowEntry[], baseDate: Date): number {
  let total = 0;
  for (const cf of cashflows) {
    const t =
      (new Date(cf.date).getTime() - baseDate.getTime()) / MS_PER_YEAR;
    total += cf.amount / Math.pow(1 + rate, t);
  }
  return total;
}

function npvDeriv(rate: number, cashflows: CashFlowEntry[], baseDate: Date): number {
  let total = 0;
  for (const cf of cashflows) {
    const t =
      (new Date(cf.date).getTime() - baseDate.getTime()) / MS_PER_YEAR;
    total -= (t * cf.amount) / Math.pow(1 + rate, t + 1);
  }
  return total;
}

/**
 * XIRR – Newton-Raphson עם fallback ל-bisection.
 * cashflows: שלילי = יציאה (buy/deposit), חיובי = כניסה (sell/dividend).
 * האחרון בדרך כלל הוא current value של פוזיציות פתוחות (חיובי).
 *
 * מחזיר תשואה שנתית כשבר עשרוני (0.12 = 12%) או null אם לא מתכנס.
 */
export function xirr(
  cashflows: CashFlowEntry[],
  guess: number = 0.1
): number | null {
  if (cashflows.length < 2) return null;
  const hasPositive = cashflows.some((c) => c.amount > 0);
  const hasNegative = cashflows.some((c) => c.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const sorted = [...cashflows].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );
  const baseDate = new Date(sorted[0].date);

  // Newton-Raphson
  let rate = guess;
  const MAX_ITER = 100;
  const TOL = 1e-7;

  for (let i = 0; i < MAX_ITER; i++) {
    const f = npv(rate, sorted, baseDate);
    const fp = npvDeriv(rate, sorted, baseDate);
    if (Math.abs(fp) < 1e-12) break;
    const next = rate - f / fp;
    if (!isFinite(next)) break;
    if (Math.abs(next - rate) < TOL) {
      return next;
    }
    rate = next;
    if (rate < -0.999) rate = -0.999;
  }

  // Bisection fallback
  let low = -0.99;
  let high = 10;
  let fLow = npv(low, sorted, baseDate);
  let fHigh = npv(high, sorted, baseDate);
  if (fLow * fHigh > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const fMid = npv(mid, sorted, baseDate);
    if (Math.abs(fMid) < TOL) return mid;
    if (fMid * fLow < 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }

  return (low + high) / 2;
}

// ----------------------------------------------------------------------------
// תשואות יומיות וחישובי סיכון
// ----------------------------------------------------------------------------

/** מחזיר רשימת תשואות יומיות (return = (price_t - price_t-1) / price_t-1) */
export function dailyReturns(prices: PricePoint[]): number[] {
  if (prices.length < 2) return [];
  const sorted = [...prices].sort((a, b) =>
    a.date < b.date ? -1 : 1
  );
  const out: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].close;
    const curr = sorted[i].close;
    if (prev > 0) {
      out.push((curr - prev) / prev);
    }
  }
  return out;
}

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

const TRADING_DAYS_PER_YEAR = 252;

/**
 * Sharpe Ratio שנתי = (mean_daily_return - rf_daily) / std_daily * sqrt(252)
 * @param riskFreeRate - שיעור חסר סיכון שנתי כשבר עשרוני (0.04 = 4%)
 */
export function sharpeRatio(returns: number[], riskFreeRate: number): number | null {
  if (returns.length < 2) return null;
  const rfDaily = riskFreeRate / TRADING_DAYS_PER_YEAR;
  const excess = returns.map((r) => r - rfDaily);
  const sd = stdDev(excess);
  if (sd === 0) return null;
  return (mean(excess) / sd) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/**
 * Sortino Ratio שנתי – כמו Sharpe אבל רק על תשואות שליליות.
 */
export function sortinoRatio(returns: number[], riskFreeRate: number): number | null {
  if (returns.length < 2) return null;
  const rfDaily = riskFreeRate / TRADING_DAYS_PER_YEAR;
  const excess = returns.map((r) => r - rfDaily);
  const downside = excess.filter((r) => r < 0);
  if (downside.length < 2) return null;
  const downsideStd = Math.sqrt(
    downside.reduce((s, r) => s + r * r, 0) / downside.length
  );
  if (downsideStd === 0) return null;
  return (mean(excess) / downsideStd) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/**
 * Beta = covariance(portfolio, benchmark) / variance(benchmark)
 * שני ערוצי התשואות חייבים להיות באותו אורך (תאריכים חופפים).
 */
export function beta(
  portfolioReturns: number[],
  benchmarkReturns: number[]
): number | null {
  const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
  if (n < 30) return null;

  const p = portfolioReturns.slice(-n);
  const b = benchmarkReturns.slice(-n);
  const meanP = mean(p);
  const meanB = mean(b);

  let cov = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    cov += (p[i] - meanP) * (b[i] - meanB);
    varB += (b[i] - meanB) ** 2;
  }
  if (varB === 0) return null;
  return cov / varB;
}

/**
 * Volatility שנתית = std_daily_returns * sqrt(252)
 */
export function annualizedVolatility(returns: number[]): number | null {
  if (returns.length < 2) return null;
  return stdDev(returns) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/**
 * תשואה לתקופה: (end_price - start_price) / start_price
 * מחזיר אחוז (כשבר עשרוני).
 */
export function periodReturn(prices: PricePoint[], days: number): number | null {
  if (prices.length < 2) return null;
  const sorted = [...prices].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = sorted[sorted.length - 1];
  const cutoff = new Date(last.date);
  cutoff.setDate(cutoff.getDate() - days);
  const startPoint = sorted.find((p) => new Date(p.date) >= cutoff);
  if (!startPoint || startPoint.close === 0) return null;
  return (last.close - startPoint.close) / startPoint.close;
}

/** YTD return – מתחילת השנה הנוכחית */
export function ytdReturn(prices: PricePoint[]): number | null {
  if (prices.length < 2) return null;
  const sorted = [...prices].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = sorted[sorted.length - 1];
  const yearStart = `${last.date.slice(0, 4)}-01-01`;
  const startPoint = sorted.find((p) => p.date >= yearStart);
  if (!startPoint || startPoint.close === 0) return null;
  return (last.close - startPoint.close) / startPoint.close;
}

// ----------------------------------------------------------------------------
// תזרים מזומנים מתיק – לבניית XIRR
// ----------------------------------------------------------------------------

/** ממיר טרנזקציות תיק ל-cashflow entries מתאים ל-XIRR (mass-level) */
export interface PortfolioCashFlowTx {
  type: 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'fee' | 'dividend';
  date: string;
  quantity?: number;
  price?: number;
  commission?: number;
  amount?: number;
}

export function buildPortfolioCashFlows(
  transactions: PortfolioCashFlowTx[],
  currentValue: number,
  asOfDate: string
): CashFlowEntry[] {
  const flows: CashFlowEntry[] = [];

  for (const tx of transactions) {
    const commission = tx.commission ?? 0;
    switch (tx.type) {
      case 'buy': {
        const total = (tx.quantity ?? 0) * (tx.price ?? 0) + commission;
        if (total > 0) flows.push({ date: tx.date, amount: -total });
        break;
      }
      case 'sell': {
        const total = (tx.quantity ?? 0) * (tx.price ?? 0) - commission;
        if (total > 0) flows.push({ date: tx.date, amount: total });
        break;
      }
      case 'deposit': {
        const a = tx.amount ?? 0;
        if (a > 0) flows.push({ date: tx.date, amount: -a });
        break;
      }
      case 'withdrawal': {
        const a = tx.amount ?? 0;
        if (a > 0) flows.push({ date: tx.date, amount: a });
        break;
      }
      case 'fee': {
        const a = tx.amount ?? 0;
        if (a > 0) flows.push({ date: tx.date, amount: -a });
        break;
      }
      case 'dividend': {
        const a = tx.amount ?? 0;
        if (a > 0) flows.push({ date: tx.date, amount: a });
        break;
      }
    }
  }

  if (currentValue > 0) {
    flows.push({ date: asOfDate, amount: currentValue });
  }
  return flows;
}

// ----------------------------------------------------------------------------
// Portfolio analytics from a value series
// ----------------------------------------------------------------------------

export interface PortfolioAnalyticsResult {
  /** Annualized volatility from daily returns (e.g. 0.18 = 18%) */
  volatility: number | null;
  /** Annualized Sharpe ratio with the given risk-free rate */
  sharpe: number | null;
  /** Maximum peak-to-trough drawdown (e.g. 0.25 = 25%) */
  maxDrawdown: number | null;
  /**
   * Simple total return over the period (e.g. 0.35 = 35%).
   * מושפע מהפקדות/משיכות — לא מייצג תשואת השקעה אמיתית.
   * השתמש ב-twrReturn לתשואה מנורמלת.
   */
  totalReturn: number | null;
  /**
   * Time-Weighted Return (TWR) — תשואה שמבודדת הפקדות/משיכות.
   * מחושב מהסדרה עם external_flow_today; null אם הנתון לא זמין.
   */
  twrReturn: number | null;
  /** Number of calendar days in the series */
  periodDays: number;
}

/**
 * Yahoo (וגם מקורות אחרים) לעיתים מחזירים close על סקאלה שונה ממחיר הברוקר
 * אחרי reverse-split (למשל UVIX: Yahoo ~600 מול Colmex ~29).
 * כשיש אי-התאמה >2× ביום הכניסה — מיישרים את מחיר השוק לסקאלת הברוקר.
 * מחזיר null אם אי אפשר לחשב מחיר אמין.
 */
export const BROKER_PRICE_SCALE_MISMATCH_RATIO = 2;

export function brokerAlignedMarketPrice(
  marketPrice: number,
  entryPrice: number,
  yahooAtEntry: number | null | undefined
): number | null {
  if (!(marketPrice > 0) || !(entryPrice > 0)) return null;

  if (yahooAtEntry != null && yahooAtEntry > 0) {
    const entryRatio = yahooAtEntry / entryPrice;
    if (
      entryRatio >= BROKER_PRICE_SCALE_MISMATCH_RATIO ||
      entryRatio <= 1 / BROKER_PRICE_SCALE_MISMATCH_RATIO
    ) {
      return marketPrice * (entryPrice / yahooAtEntry);
    }
    return marketPrice;
  }

  // בלי עוגן כניסה — דחה מחיר שוק קיצוני ביחס ל-entry (הגנה מפני ספייק)
  const ratio = marketPrice / entryPrice;
  const hard = BROKER_PRICE_SCALE_MISMATCH_RATIO * 5;
  if (ratio >= hard || ratio <= 1 / hard) return null;
  return marketPrice;
}

/**
 * Computes key risk/performance analytics from a portfolio value time series.
 * @param series        Array of { date, value, external_flow? } sorted ascending.
 *                      external_flow = deposits - withdrawals for that day (positive = net inflow).
 *                      When provided, computes Time-Weighted Return (twrReturn).
 * @param riskFreeRate  Annual risk-free rate (default 4% = 0.04)
 */
export function computePortfolioAnalytics(
  series: { date: string; value: number; external_flow?: number }[],
  riskFreeRate = 0.04
): PortfolioAnalyticsResult {
  const empty: PortfolioAnalyticsResult = {
    volatility: null, sharpe: null, maxDrawdown: null,
    totalReturn: null, twrReturn: null, periodDays: 0,
  };
  if (series.length < 2) return empty;

  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const hasExternalFlow = sorted.some((p) => p.external_flow != null);

  // תשואות יומיות מותאמות לתזרים (HPR) — בלי זה משיכה נראית כקריסת תיק ב-vol/sharpe
  const returns: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].value;
    const curr = sorted[i].value;
    const flow = sorted[i].external_flow ?? 0;
    const denominator = prev + flow;
    if (denominator > 1e-9 && curr >= 0) {
      returns.push(curr / denominator - 1);
    } else if (prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }

  const vol = returns.length >= 2 ? annualizedVolatility(returns) : null;
  const sharpe = returns.length >= 2 ? sharpeRatio(returns, riskFreeRate) : null;

  // Max drawdown על ערכי תיק מותאמי-תזרים (מונע DD מזויף ממשיכות)
  let maxDrawdown: number | null = null;
  {
    let peak = 1;
    let dd = 0;
    let indexLevel = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].value;
      const curr = sorted[i].value;
      const flow = sorted[i].external_flow ?? 0;
      const denominator = prev + flow;
      if (denominator > 1e-9 && curr >= 0) {
        indexLevel *= curr / denominator;
      }
      if (indexLevel > peak) peak = indexLevel;
      if (peak > 0) {
        const cur = (peak - indexLevel) / peak;
        if (cur > dd) dd = cur;
      }
    }
    maxDrawdown = sorted.length >= 2 ? dd : null;
  }

  const firstVal = sorted[0].value;
  const lastVal = sorted[sorted.length - 1].value;
  const totalReturn = firstVal > 0 ? (lastVal - firstVal) / firstVal : null;

  // Time-Weighted Return (TWR)
  // HPR_i = V[i] / (V[i-1] + external_flow[i])
  // TWR = product(HPR_i) - 1
  let twrReturn: number | null = null;
  if (hasExternalFlow) {
    let cumulativeTwr = 1.0;
    for (let i = 1; i < sorted.length; i++) {
      const prevVal = sorted[i - 1].value;
      const currVal = sorted[i].value;
      // external_flow: deposits - withdrawals (positive = inflow)
      const flow = sorted[i].external_flow ?? 0;
      const denominator = prevVal + flow;
      if (denominator > 1e-9 && currVal >= 0) {
        cumulativeTwr *= currVal / denominator;
      }
    }
    twrReturn = cumulativeTwr - 1;
  }

  const periodDays = Math.max(
    0,
    Math.round(
      (new Date(sorted[sorted.length - 1].date).getTime() -
        new Date(sorted[0].date).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  return { volatility: vol, sharpe, maxDrawdown, totalReturn, twrReturn, periodDays };
}

/** שדות מינימליים לחישוב אחוז הצלחה בתיק */
export interface WinRateHoldingInput {
  is_closed: boolean;
  total_gain: number;
}

/**
 * אחוז נכסים פתוחים ברווח מתוך פוזיציות עם רווח/הפסד ברור (לא כולל איזון מדויק).
 */
export function computeWinRatePct(
  holdings: WinRateHoldingInput[]
): number | null {
  let wins = 0;
  let losses = 0;
  for (const h of holdings) {
    if (h.is_closed) continue;
    if (h.total_gain > 1e-6) wins += 1;
    else if (h.total_gain < -1e-6) losses += 1;
  }
  const n = wins + losses;
  if (n === 0) return null;
  return (wins / n) * 100;
}
