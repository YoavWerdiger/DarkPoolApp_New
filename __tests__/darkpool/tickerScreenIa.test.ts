import {
  formatTickerMarketCap,
  resolveTickerScreenTab,
  tickerFeedEmptyCopy,
  tickerMarketCapLabel,
  tickerScreenFeedTabLabel,
  tickerScreenHoldersTabLabel,
} from '../../screens/DarkPool/utils/tickerScreenIa';

describe('tickerScreenIa', () => {
  it('defaults to holders and maps old insider/darkpool tabs to feed', () => {
    expect(resolveTickerScreenTab(undefined)).toBe('holders');
    expect(resolveTickerScreenTab('holders')).toBe('holders');
    expect(resolveTickerScreenTab('feed')).toBe('feed');
    expect(resolveTickerScreenTab('insider')).toBe('feed');
    expect(resolveTickerScreenTab('darkpool')).toBe('feed');
  });

  it('labels Holders(N) | Feed in Hebrew without inventing a count', () => {
    expect(tickerScreenHoldersTabLabel(32)).toBe('מחזיקים (32)');
    expect(tickerScreenHoldersTabLabel(0)).toBe('מחזיקים');
    expect(tickerScreenFeedTabLabel()).toBe('פיד');
  });

  it('formats a real market-cap as a full grouped integer — not M/K/B', () => {
    expect(formatTickerMarketCap(341_000_000_000)).toBe('$341,000,000,000');
    expect(formatTickerMarketCap(1_250_000_000_000)).toBe('$1,250,000,000,000');
    expect(formatTickerMarketCap(null)).toBeNull();
    expect(formatTickerMarketCap(0)).toBeNull();
    expect(tickerMarketCapLabel()).toBe('שווי שוק');
    expect(formatTickerMarketCap(341_000_000_000)).not.toMatch(/[MKB]$/);
  });

  it('does not invent ticker feed rows', () => {
    const empty = tickerFeedEmptyCopy('PG');
    expect(empty.title).toBe('אין עסקאות מדווחות');
    expect(empty.body).toMatch(/\$PG/);
    expect(empty.body).not.toMatch(/משוער|~.*shares|midpoint/);
  });
});
