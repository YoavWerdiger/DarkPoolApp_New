import {
  CONGRESS_TRADES_ONLY_BIOGUIDES,
  congressProfileHasHoldingsSource,
  getCongressFieldSource,
} from '../../screens/DarkPool/utils/congressDataSources';

describe('congressDataSources', () => {
  it('maps since-trade to open + live with vendor fallback', () => {
    const row = getCongressFieldSource('ticker_return_since_trade');
    expect(row?.primary).toBe('yahoo_daily_open');
    expect(row?.fallback).toBe('dark_pool_congress_trades');
  });

  it('maps holdings to quiver congress_stock_holdings', () => {
    const row = getCongressFieldSource('holding_current_usd');
    expect(row?.primary).toBe('quiver_congress_holdings');
    expect(row?.endpoint).toMatch(/congress_stock_holdings/);
  });

  it('marks Khanna and McCaul as trades-only profiles', () => {
    expect(CONGRESS_TRADES_ONLY_BIOGUIDES.has('K000389')).toBe(true);
    expect(congressProfileHasHoldingsSource('K000389')).toBe(false);
    expect(congressProfileHasHoldingsSource('P000197')).toBe(true);
  });
});
