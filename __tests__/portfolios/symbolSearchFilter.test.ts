import {
  assetTypeFromSearchType,
  filterSymbolSearchResults,
  hebrewAssetTypeLabel,
  searchCryptoUniverse,
} from '../../services/portfolios/symbolSearchFilter';

const r = (symbol: string, type: string) => ({
  symbol,
  description: symbol,
  display_symbol: symbol,
  type,
});

describe('symbol search filter', () => {
  it('keeps ETFs that Finnhub labels as ETP', () => {
    const out = filterSymbolSearchResults([r('SPY', 'ETP'), r('AAPL', 'Common Stock')], 'SPY');
    expect(out.map((x) => x.symbol)).toContain('SPY');
  });

  it('labels ETP as ETF and crypto in Hebrew', () => {
    expect(hebrewAssetTypeLabel('ETP')).toBe('ETF');
    expect(hebrewAssetTypeLabel('Crypto')).toBe('קריפטו');
  });
});

describe('crypto universe', () => {
  it('finds coins by ticker and by name as Yahoo pairs', () => {
    expect(searchCryptoUniverse('btc')[0].symbol).toBe('BTC-USD');
    expect(searchCryptoUniverse('ether').map((c) => c.symbol)).toContain('ETH-USD');
  });

  it('returns nothing for an empty query', () => {
    expect(searchCryptoUniverse('  ')).toEqual([]);
  });
});

describe('assetTypeFromSearchType', () => {
  it.each([
    ['Common Stock', 'stock'],
    ['ADR', 'stock'],
    ['ETP', 'etf'],
    ['Crypto', 'crypto'],
    ['Closed-End Fund', 'fund'],
    ['', 'stock'],
  ])('%s → %s', (type, expected) => {
    expect(assetTypeFromSearchType(type)).toBe(expected);
  });
});
