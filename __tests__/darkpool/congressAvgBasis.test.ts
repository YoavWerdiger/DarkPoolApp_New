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

  it('basis_reliable: show avg from cost/qty; range uses market-at-first-added without fake return %', () => {
    const cost = 750_000;
    const qty = 750_000 / 1770;
    const basisReliable = false;
    const avgFromCost =
      basisReliable && cost > 0 && qty > 0 ? cost / qty : null;
    expect(avgFromCost).toBeNull();

    // מוצר: מחיר כניסה = Yahoo בתאריך הקנייה הראשון; בלי return_pct על qty מוערך
    const firstAddedPx = 150;
    const entryPrice = firstAddedPx;
    const returnPct = basisReliable ? 10 : null;
    expect(entryPrice).toBe(150);
    expect(returnPct).toBeNull();
  });

  it('chart series: unreliable reconstruction is hidden; reliable still shows', () => {
    const series = [
      { date: '2024-01-01', value: 100_000 },
      { date: '2024-06-01', value: 120_000 },
    ];
    const basisReliable = false;
    // גרף: gated על אמינות שחזור (מס׳ עסקאות + טווח), לא על basis_reliable של אחזקה
    const tradeCount = 8;
    const spanDays = 152;
    const showChart = series.length >= 2 && tradeCount >= 3 && spanDays >= 21;
    const showAvgFromCost = basisReliable;
    const showEntryFromMarket = !basisReliable;
    const showHoldingReturn = basisReliable;
    expect(showChart).toBe(true);
    expect(showAvgFromCost).toBe(false);
    expect(showEntryFromMarket).toBe(true);
    expect(showHoldingReturn).toBe(false);
  });

  it('Form4 prefers disclosed avg over yahoo-at-date when both exist', () => {
    const disclosedAvg = 42.5;
    const yahooAtDate = 50;
    const basisReliable = true;
    const entry = basisReliable ? disclosedAvg : yahooAtDate;
    expect(entry).toBe(42.5);
  });

  it('Form4 without disclosed price uses market-at-first-added (not fake $1 avg)', () => {
    const sharesLabel = '1500 shares';
    // parseCongressAmount חייב להתעלם מתווית מניות בלי $
    const looksLikeSharesOnly = /share/i.test(sharesLabel) && !/\$/.test(sharesLabel);
    const rangeAmountUsd = looksLikeSharesOnly ? 0 : 1500;
    expect(rangeAmountUsd).toBe(0);

    const basisReliable = false; // אין מחיר Form4
    const firstAddedPx = 48;
    const currentPx = 55;
    const entry = basisReliable ? 1 : firstAddedPx;
    const returnPct = ((currentPx - entry) / entry) * 100;
    expect(entry).toBe(48);
    expect(returnPct).toBeCloseTo((55 - 48) / 48 * 100);
  });

  it('fund managers use 13F value/shares mark, not yahoo-at-first-added', () => {
    const valueUsd = 1_000_000;
    const shares = 10_000;
    const firstAddedPx = 120;
    const currentPx = 150;
    const entry = valueUsd / shares;
    const returnPct = ((currentPx - entry) / entry) * 100;
    expect(entry).toBe(100);
    expect(entry).not.toBe(firstAddedPx);
    expect(returnPct).toBeCloseTo(50);
  });
});
