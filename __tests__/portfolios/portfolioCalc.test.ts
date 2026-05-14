import {
  calculateFifoPosition,
  xirr,
  FifoTransaction,
  CashFlowEntry,
} from '../../services/portfolios/portfolioCalc';

describe('calculateFifoPosition (FIFO P&L)', () => {
  it('returns a zeroed result for an empty transaction list', () => {
    const r = calculateFifoPosition([]);
    expect(r.open_quantity).toBe(0);
    expect(r.avg_price).toBe(0);
    expect(r.realized_gain).toBe(0);
    expect(r.is_closed).toBe(true);
  });

  it('computes avg_price for a single buy', () => {
    const txs: FifoTransaction[] = [
      { type: 'buy', date: '2025-01-01', quantity: 10, price: 100 },
    ];
    const r = calculateFifoPosition(txs);
    expect(r.open_quantity).toBe(10);
    expect(r.avg_price).toBeCloseTo(100, 6);
    expect(r.invested).toBeCloseTo(1000, 6);
    expect(r.realized_gain).toBe(0);
    expect(r.is_closed).toBe(false);
  });

  it('amortises commission into the per-unit cost basis', () => {
    const r = calculateFifoPosition([
      { type: 'buy', date: '2025-01-01', quantity: 10, price: 100, commission: 20 },
    ]);
    // Commission 20 spread across 10 units => +2/unit => avg 102
    expect(r.avg_price).toBeCloseTo(102, 6);
    expect(r.invested).toBeCloseTo(1020, 6);
  });

  it('realises P&L using FIFO ordering, not LIFO', () => {
    const txs: FifoTransaction[] = [
      { type: 'buy', date: '2025-01-01', quantity: 10, price: 100 },
      { type: 'buy', date: '2025-02-01', quantity: 10, price: 150 },
      // Sell 10 at 200 — FIFO says we sell the FIRST 10 (cost 100) first.
      { type: 'sell', date: '2025-03-01', quantity: 10, price: 200 },
    ];
    const r = calculateFifoPosition(txs);

    // Realized gain = (200 - 100) * 10 = 1000
    expect(r.realized_gain).toBeCloseTo(1000, 6);

    // Remaining 10 units came from the second lot at $150 each.
    expect(r.open_quantity).toBe(10);
    expect(r.avg_price).toBeCloseTo(150, 6);
    expect(r.is_closed).toBe(false);
  });

  it('marks position as closed when everything is sold', () => {
    const r = calculateFifoPosition([
      { type: 'buy', date: '2025-01-01', quantity: 5, price: 50 },
      { type: 'sell', date: '2025-02-01', quantity: 5, price: 60 },
    ]);
    expect(r.is_closed).toBe(true);
    expect(r.open_quantity).toBe(0);
    expect(r.realized_gain).toBeCloseTo(50, 6);
  });

  it('sorts transactions by date even if input is unordered', () => {
    const earlyBuyLateInList: FifoTransaction[] = [
      { type: 'sell', date: '2025-03-01', quantity: 5, price: 200 },
      { type: 'buy', date: '2025-01-01', quantity: 5, price: 100 },
    ];
    const r = calculateFifoPosition(earlyBuyLateInList);
    expect(r.realized_gain).toBeCloseTo(500, 6);
  });

  it('ignores degenerate non-positive quantities', () => {
    const r = calculateFifoPosition([
      { type: 'buy', date: '2025-01-01', quantity: 0, price: 100 },
      { type: 'buy', date: '2025-01-02', quantity: -5, price: 100 },
    ]);
    expect(r.open_quantity).toBe(0);
    expect(r.invested).toBe(0);
  });
});

describe('xirr (Annualized IRR)', () => {
  it('returns null when there are not both positive and negative flows', () => {
    const flows: CashFlowEntry[] = [
      { date: '2024-01-01', amount: -1000 },
      { date: '2024-06-01', amount: -500 },
    ];
    expect(xirr(flows)).toBeNull();
  });

  it('returns ~0 when proceeds equal cost over any time horizon', () => {
    const flows: CashFlowEntry[] = [
      { date: '2024-01-01', amount: -1000 },
      { date: '2024-12-31', amount: 1000 },
    ];
    const r = xirr(flows);
    expect(r).not.toBeNull();
    expect(Math.abs(r ?? 0)).toBeLessThan(1e-3);
  });

  it('returns ~10% for a 10% annual gain over one year', () => {
    const flows: CashFlowEntry[] = [
      { date: '2024-01-01', amount: -1000 },
      { date: '2025-01-01', amount: 1100 },
    ];
    const r = xirr(flows);
    expect(r).not.toBeNull();
    expect(r ?? 0).toBeGreaterThan(0.09);
    expect(r ?? 0).toBeLessThan(0.11);
  });

  it('handles intra-year flows with reasonable IRR', () => {
    const flows: CashFlowEntry[] = [
      { date: '2024-01-01', amount: -1000 },
      { date: '2024-07-01', amount: 100 },
      { date: '2025-01-01', amount: 1050 },
    ];
    const r = xirr(flows);
    expect(r).not.toBeNull();
    expect(r ?? 0).toBeGreaterThan(0.1);
    expect(r ?? 0).toBeLessThan(0.25);
  });
});
