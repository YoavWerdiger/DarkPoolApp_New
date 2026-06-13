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
  range: '1mo' | '3mo' | '6mo' | '1y' | '5y' | 'max' = 'max'
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    const res = await fetch(url);
    if (!res.ok) return out;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp) return out;
    const closes =
      result.indicators?.adjclose?.[0]?.adjclose ||
      result.indicators?.quote?.[0]?.close;
    for (let i = 0; i < result.timestamp.length; i++) {
      const c = closes?.[i];
      if (c == null) continue;
      const d = new Date(result.timestamp[i] * 1000).toISOString().slice(0, 10);
      out.set(d, c);
    }
  } catch {
    /* noop */
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
    if (!px || px <= 0) continue;

    const qty = amountUsd / px;
    if (!Number.isFinite(qty) || qty <= 0) continue;

    out.push({ date, ticker, side, amountUsd, price: px, qty });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function replayPositions(txs: NormalizedCongressTx[]): Map<string, { qty: number; cost: number }> {
  const pos = new Map<string, { qty: number; cost: number }>();
  for (const t of txs) {
    const cur = pos.get(t.ticker) ?? { qty: 0, cost: 0 };
    if (t.side === 'buy') {
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

  const dateSet = new Set<string>();
  for (const t of txs) dateSet.add(t.date);
  for (const m of pricesByTicker.values()) {
    for (const d of m.keys()) dateSet.add(d);
  }
  const dates = Array.from(dateSet).sort();
  const endDate = dates[dates.length - 1];

  let txIdx = 0;
  const positions = new Map<string, { qty: number; cost: number }>();
  const series: ValuePoint[] = [];

  for (const day of dates) {
    if (day > endDate) break;
    while (txIdx < txs.length && txs[txIdx].date <= day) {
      const t = txs[txIdx];
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
    for (const [sym, p] of positions) {
      if (p.qty <= 0) continue;
      const px = priceOnOrBefore(pricesByTicker.get(sym) ?? new Map(), day);
      if (px != null) value += p.qty * px;
    }
    if (value > 0) series.push({ date: day, value });
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
    win_rate: computeWinRate(txs),
    avg_delay_days: computeAvgDelay(rawTrades),
    trade_count: txs.length,
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
  ).slice(0, opts.maxTickers ?? 40);

  if (!tickers.length) return null;

  const pricesByTicker = new Map<string, Map<string, number>>();
  for (const sym of tickers) {
    pricesByTicker.set(sym, await fetchYahooDaily(sym, 'max'));
    await new Promise((r) => setTimeout(r, 80));
  }

  const normalized = normalizeCongressTrades(trades, pricesByTicker);
  if (!normalized.length) return null;

  return buildCongressPortfolioMetrics(normalized, pricesByTicker, trades);
}
