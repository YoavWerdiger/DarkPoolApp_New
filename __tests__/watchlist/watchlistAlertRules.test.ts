import {
  evaluateWatchlistItem,
  rangeFromDailyBars,
  type WatchlistAlertItem,
  type WatchlistAlertMarket,
} from '../../supabase/functions/_shared/watchlistAlertRules';
import {
  alertValuesFromItem,
  diffAlertPatch,
} from '../../services/watchlist/watchlistAlertForm';
import type { StockWatchlistItem } from '../../services/watchlist/watchlistTypes';

const baseItem: WatchlistAlertItem = {
  id: 'i1',
  user_id: 'u1',
  symbol: 'adbe',
  alerts_enabled: true,
  entry_price: null,
  target_price: null,
  alert_above: null,
  alert_below: null,
  alert_change_pct: null,
  alert_above_prices: [],
  alert_below_prices: [],
  alert_change_pcts: [],
  alert_entry_gain_pct: null,
  alert_entry_loss_pct: null,
  alert_entry_gain_pcts: [],
  alert_entry_loss_pcts: [],
  alert_day_high: false,
  alert_week_high: false,
  alert_week_low: false,
  alert_52w_high: false,
  alert_52w_low: false,
  alert_target_hit: false,
  alert_earnings: false,
};

const market = (over: Partial<WatchlistAlertMarket> = {}): WatchlistAlertMarket => ({
  price: 100,
  previousClose: 100,
  open: 100,
  dayHigh: 100,
  prevWeekHigh: null,
  prevWeekLow: null,
  prev52High: null,
  prev52Low: null,
  earningsDate: null,
  ...over,
});

const ctx = { tradeDate: '2026-10-19', minutesSinceOpen: 120 };

describe('watchlist alert rules (server)', () => {
  it('returns nothing when alerts are disabled', () => {
    const evals = evaluateWatchlistItem(
      { ...baseItem, alerts_enabled: false, alert_above_prices: [50] },
      market(),
      ctx,
    );
    expect(evals).toEqual([]);
  });

  it('price levels: met / re-arm / hysteresis band', () => {
    const item = { ...baseItem, alert_above_prices: ['200'], alert_below_prices: [5] };
    const at = (price: number) =>
      evaluateWatchlistItem(item, market({ price }), ctx).map((e) => [e.rule_key, e.mode, e.met]);
    expect(at(247)).toEqual([
      ['above:200', 'level', true],
      ['below:5', 'level', false],
    ]);
    // 0.3% מתחת לסף — עדיין לא נדרך מחדש
    expect(at(199.8)[0]).toEqual(['above:200', 'level', null]);
    expect(at(150)[0]).toEqual(['above:200', 'level', false]);
    expect(at(4)[1]).toEqual(['below:5', 'level', true]);
  });

  it('daily change fires once per trade date', () => {
    const evals = evaluateWatchlistItem(
      { ...baseItem, alert_change_pcts: [3] },
      market({ price: 96, previousClose: 100 }),
      ctx,
    );
    expect(evals[0]).toMatchObject({
      rule_key: 'change:3',
      mode: 'once',
      met: true,
      ref: '2026-10-19',
      kind: 'change_pct',
    });
  });

  it('day high waits 30 minutes after the open', () => {
    const item = { ...baseItem, alert_day_high: true };
    const m = market({ price: 105, open: 100, dayHigh: 105 });
    expect(evaluateWatchlistItem(item, m, { ...ctx, minutesSinceOpen: 5 })[0].met).toBeNull();
    expect(evaluateWatchlistItem(item, m, ctx)[0].met).toBe(true);
  });

  it('legacy single thresholds and target / earnings', () => {
    const evals = evaluateWatchlistItem(
      {
        ...baseItem,
        alert_above: 90,
        alert_above_prices: null,
        alert_target_hit: true,
        target_price: '100',
        alert_earnings: true,
      },
      market({ earningsDate: '2026-10-20' }),
      ctx,
    );
    expect(evals.map((e) => [e.rule_key, e.met, e.ref])).toEqual([
      ['above:90', true, null],
      ['target:100', true, null],
      ['earnings', true, '2026-10-20'],
    ]);
    expect(evals.every((e) => e.symbol === 'ADBE')).toBe(true);
  });

  it('day high: within 0.15% of the high counts, below it does not', () => {
    const item = { ...baseItem, alert_day_high: true };
    expect(evaluateWatchlistItem(item, market({ price: 104.9, open: 100, dayHigh: 105 }), ctx)[0].met).toBe(true);
    expect(evaluateWatchlistItem(item, market({ price: 104, open: 100, dayHigh: 105 }), ctx)[0].met).toBe(false);
    // מתחת לפתיחה — לא «שיא חדש»
    expect(evaluateWatchlistItem(item, market({ price: 99, open: 100, dayHigh: 99 }), ctx)[0].met).toBe(false);
  });

  it('week / 52-week high & low compare to prior sessions, once per day', () => {
    const item = {
      ...baseItem,
      alert_week_high: true,
      alert_week_low: true,
      alert_52w_high: true,
      alert_52w_low: true,
    };
    const m = market({ price: 120, prevWeekHigh: 110, prevWeekLow: 90, prev52High: 150, prev52Low: 50 });
    const byKey = Object.fromEntries(
      evaluateWatchlistItem(item, m, ctx).map((e) => [e.rule_key, [e.mode, e.met, e.ref]])
    );
    expect(byKey).toEqual({
      week_high: ['once', true, '2026-10-19'],
      week_low: ['once', false, '2026-10-19'],
      y52_high: ['once', false, '2026-10-19'],
      y52_low: ['once', false, '2026-10-19'],
    });
    // בלי היסטוריה — לא משנה מצב (null), לא יורה
    expect(evaluateWatchlistItem(item, market({ price: 120 }), ctx).every((e) => e.met === null)).toBe(true);
  });

  it('target below entry is a downside target', () => {
    const item = { ...baseItem, alert_target_hit: true, target_price: 80, entry_price: 100 };
    expect(evaluateWatchlistItem(item, market({ price: 79 }), ctx)[0].met).toBe(true);
    expect(evaluateWatchlistItem(item, market({ price: 95 }), ctx)[0].met).toBe(false);
  });

  it('target without a price is not evaluated', () => {
    expect(
      evaluateWatchlistItem({ ...baseItem, alert_target_hit: true, target_price: null }, market(), ctx)
    ).toEqual([]);
  });

  it('range stats exclude today', () => {
    const r = rangeFromDailyBars(
      [
        { date: '2026-10-13', high: 10, low: 8 },
        { date: '2026-10-14', high: 12, low: 9 },
        { date: '2026-10-19', high: 50, low: 1 },
      ],
      '2026-10-19',
    );
    expect(r).toEqual({ prevWeekHigh: 12, prevWeekLow: 8, prev52High: 12, prev52Low: 8 });
  });
});

describe('watchlist alert form diff (client)', () => {
  const item = {
    id: 'i1',
    symbol: 'ADBE',
    alerts_enabled: true,
    alert_above: 10,
    alert_above_prices: [10, 200],
    alert_below: null,
    alert_below_prices: [],
    alert_change_pct: null,
    alert_change_pcts: [],
    alert_entry_gain_pcts: [5],
    alert_day_high: true,
  } as unknown as StockWatchlistItem;

  it('saves nothing when nothing changed', () => {
    const v = alertValuesFromItem(item);
    expect(diffAlertPatch(v, { ...v })).toEqual({});
  });

  it('only patches the fields that changed — never wipes untouched settings', () => {
    const v = alertValuesFromItem(item);
    const patch = diffAlertPatch(v, { ...v, above: [10, 200, 300], earnings: true });
    expect(patch).toEqual({ alert_above_prices: [10, 200, 300], alert_earnings: true });
    expect('alert_entry_gain_pcts' in patch).toBe(false);
    expect('alert_day_high' in patch).toBe(false);
  });

  it('target price is saved with the target toggle', () => {
    const v = alertValuesFromItem(item);
    expect(diffAlertPatch(v, { ...v, target: true, targetPrice: 300 })).toEqual({
      alert_target_hit: true,
      target_price: 300,
    });
  });
});
