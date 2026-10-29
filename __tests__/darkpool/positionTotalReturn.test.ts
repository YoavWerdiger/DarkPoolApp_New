import {
  congressPositionTotalReturnPct,
  disclosedAmountMidpoint,
  insiderPositionTotalReturnPct,
} from '../../screens/DarkPool/utils/positionTotalReturn';

describe('position total return', () => {
  it('insider: average cost across buys, sells reduce proportionally', () => {
    const pct = insiderPositionTotalReturnPct(
      [
        { transaction_type: 'P', transaction_date: '2026-01-01', shares: 100, price: 50 },
        { transaction_type: 'P', transaction_date: '2026-02-01', shares: 100, price: 100 },
      ],
      120
    );
    expect(pct).toBeCloseTo(60); // avg 75 → 120
  });

  it('congress: midpoint dollars at entry implied by Quiver change', () => {
    expect(disclosedAmountMidpoint('$1,001 - $15,000')).toBe(8000.5);
    expect(disclosedAmountMidpoint('$50K–$100K')).toBe(75000);
    // one buy, +20% since → total return +20%
    const pct = congressPositionTotalReturnPct(
      [{ transaction_type: 'Purchase', transaction_date: '2026-01-01', amount_label: '$1,001 - $15,000', price_change_pct: 20 }],
      120
    );
    expect(pct).toBeCloseTo(20);
  });

  it('returns null without priced buys', () => {
    expect(insiderPositionTotalReturnPct([{ transaction_type: 'S', shares: 10, price: 5 }], 10)).toBeNull();
  });
});
