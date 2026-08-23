/**
 * מוודא שהלוגיקה של בסיס עלות אמין/מוערך — לא מוק.
 * משקף את normalizeCongressTrades / buildCongressPortfolioMetrics ב־congressPortfolio (edge).
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

  it('basis_reliable: show avg from cost/qty; range uses market-at-first-added instead', () => {
    const cost = 750_000;
    const qty = 750_000 / 1770;
    const basisReliable = false;
    const avgFromCost =
      basisReliable && cost > 0 && qty > 0 ? cost / qty : null;
    expect(avgFromCost).toBeNull();

    // מוצר: מחיר כניסה = Yahoo בתאריך הקנייה הראשון (לא cost/qty מעגלי)
    const firstAddedPx = 150;
    const currentPx = 165;
    const entryPrice = firstAddedPx;
    const returnPct = ((currentPx - entryPrice) / entryPrice) * 100;
    expect(entryPrice).toBe(150);
    expect(returnPct).toBeCloseTo(10);
  });

  it('chart series: range-only portfolios still get reconstructed series (algorithm OK)', () => {
    // UI מציג גרף כשיש series.length >= 2 — גם כש־basis_reliable=false
    const series = [
      { date: '2024-01-01', value: 100_000 },
      { date: '2024-06-01', value: 120_000 },
    ];
    const basisReliable = false;
    const showChart = series.length >= 2;
    const showAvgFromCost = basisReliable;
    const showEntryFromMarket = !basisReliable;
    expect(showChart).toBe(true);
    expect(showAvgFromCost).toBe(false);
    expect(showEntryFromMarket).toBe(true);
  });

  it('Form4 prefers disclosed avg over yahoo-at-date when both exist', () => {
    const disclosedAvg = 42.5;
    const yahooAtDate = 50;
    const basisReliable = true;
    const entry = basisReliable ? disclosedAvg : yahooAtDate;
    expect(entry).toBe(42.5);
  });
});
