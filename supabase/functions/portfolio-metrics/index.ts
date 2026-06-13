// portfolio-metrics edge function
// ----------------------------------------------------------------------------
// מחשב מטריקות אנליזה לתיק:
//   - Beta (1Y/3Y/5Y) מול benchmark
//   - Sharpe / Sortino ratios
//   - Volatility 1M
//   - Performance per period (1W/1M/3M/YTD/1Y/5Y/All)
//   - Holdings performance comparison
//
// קלט: { portfolio_id: string }
// פלט: PortfolioAnalysis (ראה portfolioTypes.ts בלקוח)
//
// השירות בונה תזרים שווי-תיק יומי על בסיס הטרנזקציות + מחירי close היסטוריים
// של המניות, ומחשב את כל המטריקות באמצעות אלגוריתמים פיננסיים סטנדרטיים.
// ----------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const TRADING_DAYS_PER_YEAR = 252;
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

interface PricePoint {
  date: string;
  close: number;
}

interface Tx {
  type: 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'fee' | 'dividend';
  symbol: string | null;
  date: string;
  quantity: number | null;
  price: number | null;
  commission: number | null;
  amount: number | null;
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance =
    arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function dailyReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    if (prev > 0) out.push((prices[i] - prev) / prev);
  }
  return out;
}

async function fetchYahooDaily(
  symbol: string,
  range: '1mo' | '3mo' | '6mo' | '1y' | '5y' | 'max'
): Promise<PricePoint[]> {
  try {
    const url = `${YAHOO_BASE}/${encodeURIComponent(
      symbol
    )}?range=${range}&interval=1d`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp) return [];
    const closes =
      result.indicators?.adjclose?.[0]?.adjclose ||
      result.indicators?.quote?.[0]?.close;
    const points: PricePoint[] = [];
    for (let i = 0; i < result.timestamp.length; i++) {
      const c = closes?.[i];
      if (c == null) continue;
      const d = new Date(result.timestamp[i] * 1000)
        .toISOString()
        .slice(0, 10);
      points.push({ date: d, close: c });
    }
    return points;
  } catch {
    return [];
  }
}

/** בונה סדרת שווי-תיק יומי. */
function buildPortfolioDailyValueSeries(
  txs: Tx[],
  pricesBySymbol: Map<string, Map<string, number>>
): PricePoint[] {
  // ממיין tx, מתעדכן יום-יום
  if (!txs.length) return [];
  const sorted = [...txs].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );
  const startDate = sorted[0].date.slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);

  // איסוף כל התאריכים שיש להם מחירי benchmark (כדי לסגור-סנכרן)
  const symbols = Array.from(pricesBySymbol.keys());
  const dateSet = new Set<string>();
  for (const sym of symbols) {
    const m = pricesBySymbol.get(sym)!;
    for (const d of m.keys()) {
      if (d >= startDate && d <= endDate) dateSet.add(d);
    }
  }
  const allDates = Array.from(dateSet).sort();
  if (!allDates.length) return [];

  // pointer ל-tx שטרם הוטמעו
  let txIdx = 0;
  let cash = 0;
  const positions = new Map<string, number>(); // symbol → qty

  const series: PricePoint[] = [];
  for (const day of allDates) {
    while (txIdx < sorted.length && sorted[txIdx].date.slice(0, 10) <= day) {
      const t = sorted[txIdx];
      const commission = Number(t.commission ?? 0);
      switch (t.type) {
        case 'buy': {
          const qty = Number(t.quantity ?? 0);
          const px = Number(t.price ?? 0);
          cash -= qty * px + commission;
          positions.set(
            t.symbol!,
            (positions.get(t.symbol!) ?? 0) + qty
          );
          break;
        }
        case 'sell': {
          const qty = Number(t.quantity ?? 0);
          const px = Number(t.price ?? 0);
          cash += qty * px - commission;
          positions.set(
            t.symbol!,
            (positions.get(t.symbol!) ?? 0) - qty
          );
          break;
        }
        case 'deposit':
          cash += Number(t.amount ?? 0);
          break;
        case 'withdrawal':
          cash -= Number(t.amount ?? 0);
          break;
        case 'fee':
          cash -= Number(t.amount ?? 0);
          break;
        case 'dividend':
          cash += Number(t.amount ?? 0);
          break;
      }
      txIdx++;
    }

    let totalValue = cash;
    for (const [sym, qty] of positions) {
      if (qty <= 0) continue;
      const m = pricesBySymbol.get(sym);
      if (!m) continue;
      const px = m.get(day);
      if (px != null) totalValue += qty * px;
    }
    series.push({ date: day, close: totalValue });
  }

  return series;
}

function periodReturn(series: PricePoint[], days: number): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const cutoff = new Date(last.date);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const startPoint = series.find((p) => p.date >= cutoffIso);
  if (!startPoint || startPoint.close === 0) return null;
  return ((last.close - startPoint.close) / startPoint.close) * 100;
}

function ytdReturn(series: PricePoint[]): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const yearStart = `${last.date.slice(0, 4)}-01-01`;
  const startPoint = series.find((p) => p.date >= yearStart);
  if (!startPoint || startPoint.close === 0) return null;
  return ((last.close - startPoint.close) / startPoint.close) * 100;
}

function allReturn(series: PricePoint[]): number | null {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  if (first.close === 0) return null;
  return ((last.close - first.close) / first.close) * 100;
}

// ----------------------------------------------------------------------------
// Main handler
// ----------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const portfolioId = body.portfolio_id as string | undefined;
    if (!portfolioId) {
      return new Response(
        JSON.stringify({ error: 'portfolio_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ודא שהמשתמש בעלים על התיק
    const { data: portfolio, error: pErr } = await supabase
      .from('portfolios')
      .select('id, user_id, benchmark_symbol, risk_free_rate')
      .eq('id', portfolioId)
      .maybeSingle();
    if (pErr || !portfolio || portfolio.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // טען טרנזקציות
    const { data: txData, error: txErr } = await supabase
      .from('portfolio_transactions')
      .select('type, symbol, date, quantity, price, commission, amount')
      .eq('portfolio_id', portfolioId)
      .order('date', { ascending: true });
    if (txErr) throw txErr;

    const transactions: Tx[] = (txData ?? []) as Tx[];

    // אסוף סימבולים ייחודיים
    const symbols = Array.from(
      new Set(transactions.map((t) => t.symbol).filter(Boolean) as string[])
    );

    // טען מחירים יומיים לכל סימבול + benchmark (5y range)
    const pricesBySymbol = new Map<string, Map<string, number>>();
    await Promise.all(
      symbols.map(async (sym) => {
        const points = await fetchYahooDaily(sym, '5y');
        const m = new Map<string, number>();
        for (const p of points) m.set(p.date, p.close);
        pricesBySymbol.set(sym, m);
      })
    );

    const benchmarkSymbol = portfolio.benchmark_symbol || 'SPY';
    const benchmarkPoints = await fetchYahooDaily(benchmarkSymbol, '5y');

    // בנה סדרת שווי-תיק יומית
    const portfolioSeries = buildPortfolioDailyValueSeries(
      transactions,
      pricesBySymbol
    );

    // תשואות יומיות
    const portfolioReturns = dailyReturns(portfolioSeries.map((p) => p.close));
    const benchmarkReturns = dailyReturns(benchmarkPoints.map((p) => p.close));

    // יישור באורך - אינדקסים אחרונים
    const minLen = Math.min(portfolioReturns.length, benchmarkReturns.length);
    const pTrim = portfolioReturns.slice(-minLen);
    const bTrim = benchmarkReturns.slice(-minLen);

    // Sharpe / Sortino
    const riskFree = Number(portfolio.risk_free_rate ?? 4) / 100;
    const rfDaily = riskFree / TRADING_DAYS_PER_YEAR;
    const excess = pTrim.map((r) => r - rfDaily);

    let sharpe: number | null = null;
    if (excess.length >= 2) {
      const sd = stdDev(excess);
      if (sd > 0) sharpe = (mean(excess) / sd) * Math.sqrt(TRADING_DAYS_PER_YEAR);
    }

    let sortino: number | null = null;
    if (excess.length >= 2) {
      const downside = excess.filter((r) => r < 0);
      if (downside.length >= 2) {
        const dsStd = Math.sqrt(
          downside.reduce((s, r) => s + r * r, 0) / downside.length
        );
        if (dsStd > 0)
          sortino = (mean(excess) / dsStd) * Math.sqrt(TRADING_DAYS_PER_YEAR);
      }
    }

    // Beta (1Y/3Y)
    function beta(p: number[], b: number[], days: number): number | null {
      const slice = days > 0 ? days : p.length;
      const n = Math.min(p.length, b.length, slice);
      if (n < 30) return null;
      const pp = p.slice(-n);
      const bb = b.slice(-n);
      const meanP = mean(pp);
      const meanB = mean(bb);
      let cov = 0;
      let varB = 0;
      for (let i = 0; i < n; i++) {
        cov += (pp[i] - meanP) * (bb[i] - meanB);
        varB += (bb[i] - meanB) ** 2;
      }
      return varB > 0 ? cov / varB : null;
    }

    const beta1Y = beta(pTrim, bTrim, TRADING_DAYS_PER_YEAR);
    const beta3Y = beta(pTrim, bTrim, TRADING_DAYS_PER_YEAR * 3);

    // Volatility 1M (annualized)
    const vol1M =
      pTrim.length >= 21
        ? stdDev(pTrim.slice(-21)) * Math.sqrt(TRADING_DAYS_PER_YEAR)
        : null;

    // Performance per period
    const performance_periods = {
      '1W': periodReturn(portfolioSeries, 7),
      '1M': periodReturn(portfolioSeries, 30),
      '3M': periodReturn(portfolioSeries, 91),
      YTD: ytdReturn(portfolioSeries),
      '1Y': periodReturn(portfolioSeries, 365),
      '5Y': periodReturn(portfolioSeries, 365 * 5),
      All: allReturn(portfolioSeries),
    };

    // Benchmark comparison (alpha = portfolio - benchmark על אותה תקופה)
    const periods: Array<'1W' | '1M' | '3M' | 'YTD' | '1Y' | 'All'> = [
      '1W',
      '1M',
      '3M',
      'YTD',
      '1Y',
      'All',
    ];
    const benchmark_comparison = periods.map((period) => {
      const portfolioReturn = performance_periods[period] ?? 0;
      let bret: number | null;
      switch (period) {
        case '1W':
          bret = periodReturn(benchmarkPoints, 7);
          break;
        case '1M':
          bret = periodReturn(benchmarkPoints, 30);
          break;
        case '3M':
          bret = periodReturn(benchmarkPoints, 91);
          break;
        case 'YTD':
          bret = ytdReturn(benchmarkPoints);
          break;
        case '1Y':
          bret = periodReturn(benchmarkPoints, 365);
          break;
        case 'All':
          bret = allReturn(benchmarkPoints);
          break;
      }
      return {
        period,
        portfolio_return: portfolioReturn ?? 0,
        benchmark_return: bret ?? 0,
        alpha: (portfolioReturn ?? 0) - (bret ?? 0),
      };
    });

    return new Response(
      JSON.stringify({
        beta_1y: beta1Y,
        beta_3y: beta3Y,
        sharpe_ratio: sharpe,
        sortino_ratio: sortino,
        volatility_1m: vol1M,
        performance_periods,
        benchmark_comparison,
        portfolio_series: portfolioSeries,
        benchmark_series: benchmarkPoints,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('portfolio-metrics error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message ?? 'internal' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
