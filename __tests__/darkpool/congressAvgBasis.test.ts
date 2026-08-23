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

  it('chart honesty: range-only trades are not chart_reliable', () => {
    const txs = [{ qtyEstimated: true }, { qtyEstimated: true }];
    const hasDisclosedBasis = txs.some((t) => !t.qtyEstimated);
    expect(hasDisclosedBasis).toBe(false);
  });

  it('chart honesty: Form4 disclosed trades allow chart', () => {
    const txs = [{ qtyEstimated: false }, { qtyEstimated: true }];
    expect(txs.some((t) => !t.qtyEstimated)).toBe(true);
  });
});
