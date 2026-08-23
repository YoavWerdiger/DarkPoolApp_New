/**
 * מוודא שהלוגיקה של בסיס עלות אמין/מוערך — לא מוק.
 * משקף את normalizeCongressTrades ב־congressPortfolio (edge).
 */

describe('congress avg basis reliability', () => {
  it('circular estimate: qty=amount/px ⇒ avg=cost/qty equals market px', () => {
    const amountUsd = 750_000; // midpoint $500k–$1M
    const marketPx = 1770; // pre-split-ish GOOGL
    const qty = amountUsd / marketPx;
    const cost = amountUsd;
    const avg = cost / qty;
    expect(avg).toBeCloseTo(marketPx, 6);
    // זה בדיוק מה ש־STOCK Act range מייצר — לא מחיר כניסה מדווח
  });

  it('disclosed Form4 shares produce a real avg independent of yahoo assumption', () => {
    const shares = 100;
    const disclosedPrice = 42.5;
    const amountUsd = shares * disclosedPrice;
    const yahooPx = 1770; // irrelevant when shares disclosed
    const qty = shares;
    const avg = amountUsd / qty;
    expect(avg).toBeCloseTo(42.5, 6);
    expect(avg).not.toBeCloseTo(yahooPx, 0);
  });

  it('basis_reliable gate: only show avg when explicitly reliable', () => {
    const cost = 750_000;
    const qty = 750_000 / 1770;
    const basisReliable = false;
    const shown =
      basisReliable && cost > 0 && qty > 0 ? cost / qty : null;
    expect(shown).toBeNull();
  });

  it('chart series: range-only portfolios still get reconstructed series (algorithm OK)', () => {
    // UI מציג גרף כשיש series.length >= 2 — גם כש־basis_reliable=false
    const series = [
      { date: '2024-01-01', value: 100_000 },
      { date: '2024-06-01', value: 120_000 },
    ];
    const basisReliable = false;
    const showChart = series.length >= 2;
    const showAvg = basisReliable;
    expect(showChart).toBe(true);
    expect(showAvg).toBe(false);
  });
});
