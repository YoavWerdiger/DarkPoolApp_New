/**
 * Reconstruction של תיק פוליטיקאי מעסקאות STIR (UW) + מחירי Yahoo.
 * positions-only — ללא cash flow מדויק (כמו Insider Wave).
 */

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

export interface CongressTradeInput {
  ticker?: string;
  symbol?: string;
  txn_type?: string;
  amounts?: string;
  transaction_date?: string;
  filed_at_date?: string;
}

export interface NormalizedCongressTx {
  date: string;
  ticker: string;
  side: 'buy' | 'sell';
  amountUsd: number;
  price: number;
  qty: number;
}

export interface PortfolioHoldingMetric {
  ticker: string;
  qty: number;
  cost_usd: number;
  current_price: number;
  market_value: number;
  allocation_pct: number;
  return_pct: number;
  /** תאריך קנייה ראשון בפוזיציה הפתוחה הנוכחית (YYYY-MM-DD) */
  first_added_date?: string | null;
}

export interface ValuePoint {
  date: string;
  value: number;
}

export interface CongressPortfolioMetrics {
  portfolio_value: number;
  total_cost: number;
  total_return_usd: number;
  total_return_pct: number;
  series: ValuePoint[];
  holdings: PortfolioHoldingMetric[];
  period_returns: Record<string, number | null>;
  win_rate: number | null;
  avg_delay_days: number | null;
  trade_count: number;
  risk?: {
    volatility_pct: number | null;
    sharpe: number | null;
    sortino: number | null;
    max_drawdown_pct: number | null;
    period_days: number;
  };
  concentration?: {
    hhi: number;
    top3_pct: number;
    unique_tickers: number;
  };
  score?: {
    total: number;
    components: {
      return: number;
      win_rate: number;
      sharpe: number;
      diversification: number;
      activity: number;
    };
  };
}

export function parseCongressAmount(raw?: string | null): number {
  if (!raw) return 0;
  const nums =
    raw.match(/[\d,]+/g)?.map((s) => parseInt(s.replace(/,/g, ''), 10)).filter((n) => n > 0) ??
    [];
  if (!nums.length) return 0;
  if (nums.length === 1) return nums[0];
  return Math.round((nums[0] + nums[nums.length - 1]) / 2);
}

export function parseTxnSide(txn?: string): 'buy' | 'sell' | null {
  const t = (txn || '').toLowerCase();
  if (t.includes('sell') || t.includes('sale') || t === 's') return 'sell';
  if (t.includes('buy') || t.includes('purchase') || t === 'p') return 'buy';
  return null;
}

export function priceOnOrBefore(
  priceMap: Map<string, number>,
  date: string
): number | null {
  const d = date.slice(0, 10);
  if (priceMap.has(d)) return priceMap.get(d)!;
  let best: string | null = null;
  for (const k of priceMap.keys()) {
    if (k <= d && (!best || k > best)) best = k;
  }
  return best ? priceMap.get(best)! : null;
}

export async function fetchYahooDaily(
  symbol: string,
  range: '1mo' | '3mo' | '6mo' | '1y' | '5y' | 'max' = '5y'
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return out;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp) return out;
    const closes =
      result.indicators?.adjclose?.[0]?.adjclose ||
      result.indicators?.quote?.[0]?.close;
    for (let i = 0; i < result.timestamp.length; i++) {
      const c = closes?.[i];
      if (c == null || !Number.isFinite(c) || c <= 0) continue;
      const d = new Date(result.timestamp[i] * 1000).toISOString().slice(0, 10);
      out.set(d, c);
    }
  } catch {
    /* Yahoo לעיתים חסום מ-Edge — ממשיכים עם notional */
  } finally {
    clearTimeout(timer);
  }
  return out;
}

/** ממלא מחירים יומיים (forward-fill) בין תאריך התחלה לסוף */
function forwardFillDailyPrices(
  raw: Map<string, number>,
  startDate: string,
  endDate: string
): Map<string, number> {
  const out = new Map<string, number>();
  let last: number | null = null;
  const d = new Date(`${startDate.slice(0, 10)}T12:00:00Z`);
  const end = new Date(`${endDate.slice(0, 10)}T12:00:00Z`);
  while (d <= end) {
    const key = d.toISOString().slice(0, 10);
    if (raw.has(key)) last = raw.get(key)!;
    if (last != null) out.set(key, last);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** מוסיף מחירי עסקה כ-fallback כש-Yahoo ריק */
function mergeTradePricesIntoMap(
  ticker: string,
  txs: NormalizedCongressTx[],
  priceMap: Map<string, number>
): Map<string, number> {
  const merged = new Map(priceMap);
  for (const t of txs) {
    if (t.ticker !== ticker || t.price <= 0) continue;
    merged.set(t.date.slice(0, 10), t.price);
  }
  return merged;
}

function prepareFilledPricesByTicker(
  txs: NormalizedCongressTx[],
  pricesByTicker: Map<string, Map<string, number>>
): Map<string, Map<string, number>> {
  if (!txs.length) return new Map();
  const startDate = txs[0].date.slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);
  const tickers = Array.from(new Set(txs.map((t) => t.ticker)));
  const out = new Map<string, Map<string, number>>();

  for (const sym of tickers) {
    const raw = pricesByTicker.get(sym) ?? new Map();
    const withTrades = mergeTradePricesIntoMap(sym, txs, raw);
    out.set(sym, forwardFillDailyPrices(withTrades, startDate, endDate));
  }
  return out;
}

export function normalizeCongressTrades(
  trades: CongressTradeInput[],
  pricesByTicker: Map<string, Map<string, number>>
): NormalizedCongressTx[] {
  const out: NormalizedCongressTx[] = [];
  for (const t of trades) {
    const ticker = String(t.ticker ?? t.symbol ?? '').toUpperCase().trim();
    const side = parseTxnSide(t.txn_type);
    const date = String(t.transaction_date ?? t.filed_at_date ?? '').slice(0, 10);
    const amountUsd = parseCongressAmount(t.amounts);
    if (!ticker || !side || !date || amountUsd < 100) continue;
    if (ticker.length > 5 || ticker === '—') continue;

    const priceMap = pricesByTicker.get(ticker) ?? new Map();
    let px = priceOnOrBefore(priceMap, date);
    if (!px && t.filed_at_date) {
      px = priceOnOrBefore(priceMap, String(t.filed_at_date).slice(0, 10));
    }
    // בלי מחיר שוק: יחידות notional (price=1, qty=$) — עדיין בונה שווי תיק משוער
    if (!px || px <= 0) px = 1;

    const qty = amountUsd / px;
    if (!Number.isFinite(qty) || qty <= 0) continue;

    out.push({ date, ticker, side, amountUsd, price: px, qty });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** סדרת שווי משוערת ממצטבר עסקאות — כשאין מחירי Yahoo */
function buildNotionalSeries(txs: NormalizedCongressTx[]): ValuePoint[] {
  if (!txs.length) return [];
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  const pos = new Map<string, number>();
  const series: ValuePoint[] = [];
  for (const t of sorted) {
    const cur = pos.get(t.ticker) ?? 0;
    if (t.side === 'buy') pos.set(t.ticker, cur + t.amountUsd);
    else pos.set(t.ticker, Math.max(0, cur - t.amountUsd));
    let value = 0;
    for (const v of pos.values()) value += v;
    if (value > 0) {
      const last = series[series.length - 1];
      if (last && last.date === t.date) last.value = value;
      else series.push({ date: t.date, value });
    }
  }
  // נקודת סיום «היום» כדי שהגרף לא ייעצר בעסקה האחרונה
  if (series.length >= 1) {
    const today = new Date().toISOString().slice(0, 10);
    const last = series[series.length - 1];
    if (last.date < today) series.push({ date: today, value: last.value });
  }
  return series;
}

function replayPositions(
  txs: NormalizedCongressTx[]
): Map<string, { qty: number; cost: number; first_added_date: string | null }> {
  const pos = new Map<string, { qty: number; cost: number; first_added_date: string | null }>();
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    const cur = pos.get(t.ticker) ?? { qty: 0, cost: 0, first_added_date: null };
    const day = t.date.slice(0, 10);
    if (t.side === 'buy') {
      if (cur.qty <= 0) cur.first_added_date = day;
      cur.qty += t.qty;
      cur.cost += t.amountUsd;
    } else {
      if (cur.qty <= 0) continue;
      const sellQty = Math.min(cur.qty, t.qty);
      const avg = cur.cost / cur.qty;
      cur.qty -= sellQty;
      cur.cost -= avg * sellQty;
      if (cur.qty < 1e-8) {
        cur.qty = 0;
        cur.cost = 0;
        cur.first_added_date = null;
      }
    }
    pos.set(t.ticker, cur);
  }
  return pos;
}

function buildDailySeries(
  txs: NormalizedCongressTx[],
  pricesByTicker: Map<string, Map<string, number>>
): ValuePoint[] {
  if (!txs.length) return [];

  const sortedTxs = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = sortedTxs[0].date.slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);
  const filledPrices = prepareFilledPricesByTicker(sortedTxs, pricesByTicker);

  const dateSet = new Set<string>();
  for (const m of filledPrices.values()) {
    for (const d of m.keys()) {
      if (d >= startDate && d <= endDate) dateSet.add(d);
    }
  }
  const dates = Array.from(dateSet).sort();
  if (dates.length < 2) return [];

  let txIdx = 0;
  const positions = new Map<string, { qty: number; cost: number }>();
  const series: ValuePoint[] = [];

  for (const day of dates) {
    while (txIdx < sortedTxs.length && sortedTxs[txIdx].date.slice(0, 10) <= day) {
      const t = sortedTxs[txIdx];
      const cur = positions.get(t.ticker) ?? { qty: 0, cost: 0 };
      if (t.side === 'buy') {
        cur.qty += t.qty;
        cur.cost += t.amountUsd;
      } else if (cur.qty > 0) {
        const sellQty = Math.min(cur.qty, t.qty);
        const avg = cur.cost / cur.qty;
        cur.qty -= sellQty;
        cur.cost -= avg * sellQty;
        if (cur.qty < 1e-8) {
          cur.qty = 0;
          cur.cost = 0;
        }
      }
      positions.set(t.ticker, cur);
      txIdx++;
    }

    let value = 0;
    let hasPosition = false;
    for (const [sym, p] of positions) {
      if (p.qty <= 0) continue;
      hasPosition = true;
      const px = filledPrices.get(sym)?.get(day);
      if (px != null && px > 0) value += p.qty * px;
    }
    if (hasPosition && value > 0) series.push({ date: day, value });
  }
  return series;
}

function periodReturn(series: ValuePoint[], days: number): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const cutoff = new Date(last.date);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const start = series.find((p) => p.date >= cutoffIso);
  if (!start || start.value <= 0) return null;
  return ((last.value - start.value) / start.value) * 100;
}

function ytdReturn(series: ValuePoint[]): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const yearStart = `${last.date.slice(0, 4)}-01-01`;
  const start = series.find((p) => p.date >= yearStart);
  if (!start || start.value <= 0) return null;
  return ((last.value - start.value) / start.value) * 100;
}

function computeWinRate(txs: NormalizedCongressTx[]): number | null {
  const sells = txs.filter((t) => t.side === 'sell');
  if (!sells.length) return null;
  let wins = 0;
  const costBasis = new Map<string, { qty: number; avg: number }>();
  for (const t of txs) {
    if (t.side === 'buy') {
      const c = costBasis.get(t.ticker) ?? { qty: 0, avg: 0 };
      const totalCost = c.avg * c.qty + t.amountUsd;
      c.qty += t.qty;
      c.avg = c.qty > 0 ? totalCost / c.qty : 0;
      costBasis.set(t.ticker, c);
    } else {
      const c = costBasis.get(t.ticker);
      if (!c || c.qty <= 0) continue;
      const proceeds = t.amountUsd;
      const cost = c.avg * Math.min(c.qty, t.qty);
      if (proceeds > cost) wins++;
      const sold = Math.min(c.qty, t.qty);
      c.qty -= sold;
      if (c.qty <= 0) costBasis.delete(t.ticker);
    }
  }
  return Math.round((wins / sells.length) * 1000) / 10;
}

function computeAvgDelay(trades: CongressTradeInput[]): number | null {
  const delays: number[] = [];
  for (const t of trades) {
    const tx = String(t.transaction_date ?? '').slice(0, 10);
    const filed = String(t.filed_at_date ?? '').slice(0, 10);
    if (!tx || !filed) continue;
    const a = Date.parse(tx);
    const b = Date.parse(filed);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    delays.push(Math.max(0, Math.round((b - a) / 86400000)));
  }
  if (!delays.length) return null;
  return Math.round(delays.reduce((s, d) => s + d, 0) / delays.length);
}

const TRADING_DAYS = 252;
const RF = 0.04;

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}

function computeSeriesRisk(series: ValuePoint[]) {
  if (series.length < 2) {
    return {
      volatility_pct: null,
      sharpe: null,
      sortino: null,
      max_drawdown_pct: null,
      period_days: 0,
    };
  }
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const returns: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].value;
    const curr = sorted[i].value;
    if (prev > 0) returns.push((curr - prev) / prev);
  }
  const rfDaily = RF / TRADING_DAYS;
  const excess = returns.map((r) => r - rfDaily);
  const sd = stdDev(excess);
  const sharpe =
    returns.length >= 2 && sd > 0
      ? Math.round(((mean(excess) / sd) * Math.sqrt(TRADING_DAYS)) * 100) / 100
      : null;
  const vol =
    returns.length >= 2
      ? Math.round(stdDev(returns) * Math.sqrt(TRADING_DAYS) * 10000) / 100
      : null;
  const downside = excess.filter((r) => r < 0);
  const downsideStd =
    downside.length >= 2
      ? Math.sqrt(downside.reduce((s, r) => s + r * r, 0) / downside.length)
      : 0;
  const sortino =
    returns.length >= 2 && downsideStd > 0
      ? Math.round(((mean(excess) / downsideStd) * Math.sqrt(TRADING_DAYS)) * 100) / 100
      : null;

  let peak = sorted[0].value;
  let maxDd = 0;
  for (const p of sorted) {
    if (p.value > peak) peak = p.value;
    if (peak > 0) maxDd = Math.max(maxDd, (peak - p.value) / peak);
  }

  const periodDays = Math.max(
    0,
    Math.round(
      (Date.parse(sorted[sorted.length - 1].date) - Date.parse(sorted[0].date)) / 86400000
    )
  );

  return {
    volatility_pct: vol,
    sharpe,
    sortino,
    max_drawdown_pct: Math.round(maxDd * 10000) / 100,
    period_days: periodDays,
  };
}

function computeConcentration(holdings: PortfolioHoldingMetric[]) {
  if (!holdings.length) return { hhi: 0, top3_pct: 0, unique_tickers: 0 };
  const hhi = holdings.reduce((s, h) => {
    const w = h.allocation_pct / 100;
    return s + w * w;
  }, 0);
  const top3 = holdings.slice(0, 3).reduce((s, h) => s + h.allocation_pct, 0);
  return {
    hhi: Math.round(hhi * 1000) / 1000,
    top3_pct: Math.round(top3 * 10) / 10,
    unique_tickers: holdings.length,
  };
}

function computeProfileScore(input: {
  totalReturnPct: number;
  winRate: number | null;
  sharpe: number | null;
  hhi: number;
  tradeCount: number;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const ret = clamp(100 / (1 + Math.exp(-1.2 * (input.totalReturnPct / 30 - 0.5))));
  const win = input.winRate != null ? clamp(input.winRate) : 50;
  const sh = input.sharpe != null ? clamp(50 + input.sharpe * 12) : 50;
  const div = clamp((1 - input.hhi) * 100);
  const act = clamp(Math.min(100, (input.tradeCount / 20) * 100));
  const total = clamp(ret * 0.3 + win * 0.25 + sh * 0.2 + div * 0.15 + act * 0.1);
  return {
    total,
    components: { return: ret, win_rate: win, sharpe: sh, diversification: div, activity: act },
  };
}

export function buildCongressPortfolioMetrics(
  txs: NormalizedCongressTx[],
  pricesByTicker: Map<string, Map<string, number>>,
  rawTrades: CongressTradeInput[] = []
): CongressPortfolioMetrics {
  const series = buildDailySeries(txs, pricesByTicker);
  const positions = replayPositions(txs);

  const holdings: PortfolioHoldingMetric[] = [];
  let totalValue = 0;
  let totalCost = 0;

  for (const [ticker, p] of positions) {
    if (p.qty <= 0) continue;
    const priceMap = pricesByTicker.get(ticker);
    const lastDate = priceMap
      ? Array.from(priceMap.keys()).sort().pop()
      : undefined;
    const currentPrice =
      (lastDate && priceMap?.get(lastDate)) ||
      priceOnOrBefore(priceMap ?? new Map(), new Date().toISOString().slice(0, 10)) ||
      0;
    if (currentPrice <= 0) continue;
    const marketValue = p.qty * currentPrice;
    totalValue += marketValue;
    totalCost += p.cost;
    holdings.push({
      ticker,
      qty: p.qty,
      cost_usd: p.cost,
      current_price: currentPrice,
      market_value: marketValue,
      allocation_pct: 0,
      return_pct: p.cost > 0 ? ((marketValue - p.cost) / p.cost) * 100 : 0,
      first_added_date: p.first_added_date,
    });
  }

  holdings.sort((a, b) => b.market_value - a.market_value);
  for (const h of holdings) {
    h.allocation_pct =
      totalValue > 0 ? Math.round((h.market_value / totalValue) * 1000) / 10 : 0;
  }

  const totalReturnUsd = totalValue - totalCost;
  const totalReturnPct = totalCost > 0 ? (totalReturnUsd / totalCost) * 100 : 0;

  const firstSeries = series[0]?.value ?? 0;
  const allReturn =
    series.length >= 2 && firstSeries > 0
      ? ((series[series.length - 1].value - firstSeries) / firstSeries) * 100
      : totalReturnPct;

  const winRate = computeWinRate(txs);
  const risk = computeSeriesRisk(series);
  const concentration = computeConcentration(holdings);
  const score = computeProfileScore({
    totalReturnPct,
    winRate,
    sharpe: risk.sharpe,
    hhi: concentration.hhi,
    tradeCount: txs.length,
  });

  return {
    portfolio_value: Math.round(totalValue * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100,
    total_return_usd: Math.round(totalReturnUsd * 100) / 100,
    total_return_pct: Math.round(totalReturnPct * 100) / 100,
    series,
    holdings,
    period_returns: {
      '1D': periodReturn(series, 1),
      '1W': periodReturn(series, 7),
      '1M': periodReturn(series, 30),
      '3M': periodReturn(series, 90),
      YTD: ytdReturn(series),
      '1Y': periodReturn(series, 365),
      '5Y': periodReturn(series, 365 * 5),
      ALL: Math.round(allReturn * 100) / 100,
    },
    win_rate: winRate,
    avg_delay_days: computeAvgDelay(rawTrades),
    trade_count: txs.length,
    risk,
    concentration,
    score,
  };
}

export function mapInsiderTradeToCongressInput(t: {
  ticker?: string;
  transaction_type?: string;
  transaction_code?: string;
  shares?: number | string;
  price?: number | string;
  value?: number | string;
  amount?: number | string;
  transaction_date?: string;
  filed_at?: string;
  filing_date?: string;
}): CongressTradeInput {
  const code = String(t.transaction_type ?? t.transaction_code ?? 'P').toUpperCase();
  const shares = Math.abs(Number(t.shares ?? t.amount) || 0);
  const price = Number(t.price) || 0;
  const valueUsd = Number(t.value) || (shares > 0 && price > 0 ? shares * price : 0);
  const amountLabel =
    valueUsd >= 100
      ? `$${Math.round(valueUsd).toLocaleString('en-US')}`
      : shares > 0 && price > 0
        ? `$${Math.round(shares * price).toLocaleString('en-US')}`
        : shares > 0
          ? `${Math.round(shares)} shares`
          : undefined;

  return {
    ticker: t.ticker,
    txn_type: code === 'S' || code.includes('SELL') ? 'sell' : 'buy',
    amounts: amountLabel,
    transaction_date: String(
      t.transaction_date ?? t.filed_at ?? t.filing_date ?? ''
    ).slice(0, 10),
    filed_at_date: String(t.filed_at ?? t.filing_date ?? t.transaction_date ?? '').slice(
      0,
      10
    ),
  };
}

export async function metricsFromCongressTrades(
  trades: CongressTradeInput[],
  opts: { maxTickers?: number } = {}
): Promise<CongressPortfolioMetrics | null> {
  const tickers = Array.from(
    new Set(
      trades
        .map((t) => String(t.ticker ?? t.symbol ?? '').toUpperCase().trim())
        .filter((t) => t && t.length <= 5 && t !== '—')
    )
  ).slice(0, opts.maxTickers ?? 25);

  if (!tickers.length) return null;

  // שליפה מקבילית — Yahoo לעיתים נחסם מ-Edge; לא חוסמים את כל החישוב
  const pricesByTicker = new Map<string, Map<string, number>>();
  const settled = await Promise.all(
    tickers.map(async (sym) => {
      const map = await fetchYahooDaily(sym, '5y');
      return [sym, map] as const;
    })
  );
  for (const [sym, map] of settled) pricesByTicker.set(sym, map);

  const normalized = normalizeCongressTrades(trades, pricesByTicker);
  if (!normalized.length) return null;

  let metrics = buildCongressPortfolioMetrics(normalized, pricesByTicker, trades);

  // אם אין סדרת מחירים (Yahoo ריק) — בונים גרף משוער מ-notional של העסקאות
  if (!metrics.series || metrics.series.length < 2) {
    const notional = buildNotionalSeries(normalized);
    if (notional.length >= 2) {
      const lastVal = notional[notional.length - 1].value;
      const firstVal = notional[0].value;
      const allRet =
        firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : metrics.total_return_pct;
      metrics = {
        ...metrics,
        portfolio_value: Math.round(lastVal * 100) / 100,
        series: notional,
        period_returns: {
          ...metrics.period_returns,
          '1W': periodReturn(notional, 7),
          '1M': periodReturn(notional, 30),
          '3M': periodReturn(notional, 90),
          YTD: ytdReturn(notional),
          '1Y': periodReturn(notional, 365),
          '5Y': periodReturn(notional, 365 * 5),
          ALL: Math.round(allRet * 100) / 100,
        },
      };
      if (!metrics.holdings.length) {
        // holdings מ-notional לפי ticker
        const byTicker = new Map<string, number>();
        for (const t of normalized) {
          const cur = byTicker.get(t.ticker) ?? 0;
          byTicker.set(
            t.ticker,
            t.side === 'buy' ? cur + t.amountUsd : Math.max(0, cur - t.amountUsd)
          );
        }
        const total = Array.from(byTicker.values()).reduce((s, v) => s + v, 0);
        metrics.holdings = Array.from(byTicker.entries())
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([ticker, market_value]) => {
            const firstBuy = normalized.find(
              (t) => t.ticker === ticker && t.side === 'buy'
            );
            return {
              ticker,
              qty: market_value,
              cost_usd: market_value,
              current_price: 1,
              market_value,
              allocation_pct:
                total > 0 ? Math.round((market_value / total) * 1000) / 10 : 0,
              return_pct: 0,
              first_added_date: firstBuy?.date.slice(0, 10) ?? null,
            };
          });
      }
    }
  }

  return metrics;
}
