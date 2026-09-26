import { readFileSync } from 'fs';
import { join } from 'path';
import {
  formatImpliedHoldingShares,
  formatTickerHolderMetric,
  impliedHoldingShares,
  isBioguideHoldingsCacheFresh,
  isTickerHoldingsCacheFresh,
  looksLikeCompleteBioguideHoldings,
  mapTickerCongressHoldersFromCache,
  mergeTickerHoldingRowsIntoByBioguide,
  tickerHolderRowCopy,
  tickerHoldersEmptyCopy,
  tickerHoldersErrorCopy,
  tickerHoldersSectionSubtitle,
  tickerHoldersSectionTitle,
} from '../../screens/DarkPool/utils/tickerCongressHolders';

const LRI = '\u2066';
const PDI = '\u2069';

describe('mapTickerCongressHoldersFromCache', () => {
  const byBioguide = {
    P000197: [
      { BioGuideID: 'P000197', Name: 'Nancy Pelosi', Ticker: 'NVDA', CurrentHolding: 1_200_000, Allocation: 0.1187 },
      { BioGuideID: 'P000197', Name: 'Nancy Pelosi', Ticker: 'AAPL', CurrentHolding: 80_000, Allocation: 0.04 },
    ],
    H000273: [
      { BioGuideID: 'H000273', Name: 'John Hickenlooper', Ticker: 'PG', CurrentHolding: 1_200_000, Allocation: 0.08 },
    ],
    D000399: [
      { BioGuideID: 'D000399', Name: 'Lloyd Doggett', Ticker: 'PG', Allocation: 12.4 },
    ],
    K000188: [
      { BioGuideID: 'K000188', Name: 'Ro Khanna', Ticker: 'PG' },
    ],
  };

  it('filters by ticker and prefers CurrentHolding compact USD', () => {
    const holders = mapTickerCongressHoldersFromCache({
      ticker: 'pg',
      byBioguide,
    });
    expect(holders.map((h) => h.bioguideId)).toEqual(['H000273', 'D000399']);
    expect(formatTickerHolderMetric(holders[0])).toEqual({ text: '$1,200,000', kind: 'usd' });
    expect(formatTickerHolderMetric(holders[1])).toEqual({ text: '12%', kind: 'allocation' });
  });

  it('puts CurrentHolding on the right and Allocation under the name', () => {
    expect(
      tickerHolderRowCopy({ currentValueUSD: 1_200_000, allocationPct: 8.3 })
    ).toEqual({
      subtitle: '8%',
      metric: { text: '$1,200,000', kind: 'usd' },
      sharesLabel: null,
    });
    expect(
      tickerHolderRowCopy({ currentValueUSD: null, allocationPct: 12.4 })
    ).toEqual({
      subtitle: null,
      metric: { text: '12%', kind: 'allocation' },
      sharesLabel: null,
    });
    expect(tickerHolderRowCopy({ currentValueUSD: null, allocationPct: null })).toBeNull();
  });

  it('puts ~shares under CurrentHolding from USD / last price — never STOCK Act', () => {
    expect(
      tickerHolderRowCopy({ currentValueUSD: 1_200_000, allocationPct: 8.3 }, 1_000)
    ).toEqual({
      subtitle: '8%',
      metric: { text: '$1,200,000', kind: 'usd' },
      sharesLabel: '~1,200 מניות',
    });
    expect(
      tickerHolderRowCopy({ currentValueUSD: null, allocationPct: 12.4 }, 180)
    ).toEqual({
      subtitle: null,
      metric: { text: '12%', kind: 'allocation' },
      sharesLabel: null,
    });
    expect(
      tickerHolderRowCopy({ currentValueUSD: 1_200_000, allocationPct: 8.3 }, null)
    ).toEqual({
      subtitle: '8%',
      metric: { text: '$1,200,000', kind: 'usd' },
      sharesLabel: null,
    });
  });

  it('omits rows with neither CurrentHolding nor Allocation — no invented shares', () => {
    const holders = mapTickerCongressHoldersFromCache({
      ticker: 'PG',
      byBioguide,
    });
    expect(holders.find((h) => h.bioguideId === 'K000188')).toBeUndefined();
    expect(JSON.stringify(holders)).not.toMatch(/shares|מניות|1001|15,000|משוער|~/);
  });

  it('uses BioGuide / ImageURL photos and rejects ticker logos', () => {
    const holders = mapTickerCongressHoldersFromCache({
      ticker: 'PG',
      byBioguide: {
        H000273: [
          {
            BioGuideID: 'H000273',
            Name: 'John Hickenlooper',
            Ticker: 'PG',
            CurrentHolding: 5000,
            ImageURL: 'https://storage.googleapis.com/uwassets/tickers/PG.png',
          },
        ],
      },
      politicians: [
        {
          BioGuideID: 'H000273',
          Name: 'John Hickenlooper',
          ImageURL: 'https://assets.quiverquant.com/congress/H000273.jpg',
        },
      ],
    });
    expect(holders[0].imageUrl).toBe('https://assets.quiverquant.com/congress/H000273.jpg');
    expect(holders[0].imageUrl).not.toMatch(/tickers\/PG/);
  });

  it('falls back to the unitedstates congress photo when no ImageURL', () => {
    const holders = mapTickerCongressHoldersFromCache({
      ticker: 'PG',
      byBioguide: {
        H000273: [
          {
            BioGuideID: 'H000273',
            Name: 'John Hickenlooper',
            Ticker: 'PG',
            CurrentHolding: 5000,
          },
        ],
      },
    });
    expect(holders[0].imageUrl).toMatch(/H000273\.jpg/);
  });
});

describe('impliedHoldingShares', () => {
  it('divides CurrentHolding USD by last price into a grouped integer', () => {
    expect(impliedHoldingShares(1_200_000, 1_000)).toBe(1_200);
    expect(impliedHoldingShares(1_200_000, 180)).toBe(6_667);
    expect(formatImpliedHoldingShares(1_200_000, 1_000)).toBe('~1,200 מניות');
    expect(formatImpliedHoldingShares(1_200_000, 180)).toBe('~6,667 מניות');
  });

  it('omits when CurrentHolding or last price is missing — no invented shares', () => {
    expect(impliedHoldingShares(null, 180)).toBeNull();
    expect(impliedHoldingShares(1_200_000, null)).toBeNull();
    expect(impliedHoldingShares(0, 180)).toBeNull();
    expect(impliedHoldingShares(1_200_000, 0)).toBeNull();
    expect(impliedHoldingShares(50, 180)).toBeNull();
    expect(formatImpliedHoldingShares(null, 180)).toBeNull();
    expect(formatImpliedHoldingShares(1_200_000, null)).toBeNull();
    expect(formatImpliedHoldingShares(1_200_000, 1_000)).not.toMatch(/משוער|amount_label|midpoint/);
  });
});

describe('tickerHoldersSectionTitle', () => {
  it('keeps Hebrew sentence order and isolates only $PG', () => {
    const parts = tickerHoldersSectionTitle('PG');
    expect(parts.sentence).toBe('פוליטיקאים שמחזיקים $PG');
    expect(parts.sentence).not.toContain(LRI);
    expect(parts.tickerIsolated).toBe(`${LRI}$PG${PDI}`);
    expect(parts.lead).toBe('פוליטיקאים שמחזיקים ');
  });

  it('names the holding metric, not a trade journal', () => {
    expect(tickerHoldersSectionSubtitle()).toMatch(/CurrentHolding|שווי אחזקה|הקצאה/);
    expect(tickerHoldersSectionSubtitle()).toMatch(/לא יומן עסקאות/);
    const empty = tickerHoldersEmptyCopy('PG');
    expect(empty.title).toBe('אין מחזיקים מדווחים');
    expect(empty.body).toContain('$PG');
    expect(empty.body).toMatch(/CurrentHolding \/ Allocation/);
    expect(empty.body).not.toMatch(/Form 4|הדפסות|פעילות אחרונה/);
    expect(tickerHoldersErrorCopy().body).toMatch(/אין נפילה ליומן עסקאות/);
  });
});

describe('ticker holdings cache freshness + merge', () => {
  it('treats missing tickers_synced as stale — cache scan is not a ticker fetch', () => {
    expect(
      isTickerHoldingsCacheFresh(
        { by_bioguide: { P000197: [{ Ticker: 'NVDA', CurrentHolding: 1 }] } },
        'NVDA',
        86_400_000,
        Date.parse('2026-09-19T12:00:00Z')
      )
    ).toBe(false);
  });

  it('accepts a fresh tickers_synced stamp', () => {
    expect(
      isTickerHoldingsCacheFresh(
        { tickers_synced: { NVDA: '2026-09-19T10:00:00.000Z' } },
        'nvda',
        86_400_000,
        Date.parse('2026-09-19T12:00:00Z')
      )
    ).toBe(true);
  });

  it('treats 2+ tickers as a full bioguide book and a single leftover row as incomplete', () => {
    expect(
      looksLikeCompleteBioguideHoldings([
        { Ticker: 'AAPL', CurrentHolding: 18_460_942 },
        { Ticker: 'NVDA', CurrentHolding: 17_565_358 },
      ])
    ).toBe(true);
    expect(
      looksLikeCompleteBioguideHoldings([{ Ticker: 'TSLA', CurrentHolding: 27_152 }])
    ).toBe(false);
    expect(looksLikeCompleteBioguideHoldings([])).toBe(false);
  });

  it('does not treat by_bioguide rows as a full person portfolio without bioguides_synced', () => {
    expect(
      isBioguideHoldingsCacheFresh(
        {
          by_bioguide: {
            P000197: [{ Ticker: 'NVDA', CurrentHolding: 1_200_000 }],
          },
        },
        'P000197',
        86_400_000,
        Date.parse('2026-09-19T12:00:00Z')
      )
    ).toBe(false);
  });

  it('accepts a fresh bioguides_synced stamp, including an honest empty list', () => {
    expect(
      isBioguideHoldingsCacheFresh(
        {
          by_bioguide: { K000188: [] },
          bioguides_synced: { K000188: '2026-09-19T10:00:00.000Z' },
        },
        'k000188',
        86_400_000,
        Date.parse('2026-09-19T12:00:00Z')
      )
    ).toBe(true);
  });

  it('merges Quiver ticker rows and drops stale holders for that ticker only', () => {
    const merged = mergeTickerHoldingRowsIntoByBioguide(
      {
        P000197: [
          { BioGuideID: 'P000197', Ticker: 'NVDA', CurrentHolding: 10 },
          { BioGuideID: 'P000197', Ticker: 'AAPL', CurrentHolding: 80 },
        ],
        H000273: [{ BioGuideID: 'H000273', Ticker: 'NVDA', CurrentHolding: 5 }],
      },
      'NVDA',
      [
        { BioGuideID: 'P000197', Ticker: 'NVDA', CurrentHolding: 1_200_000, Allocation: 0.1 },
        { BioGuideID: 'C001114', Ticker: 'NVDA', CurrentHolding: 50_000, Allocation: 0.02 },
      ]
    );
    expect(merged.P000197.find((r) => r.Ticker === 'AAPL')?.CurrentHolding).toBe(80);
    expect(merged.P000197.find((r) => r.Ticker === 'NVDA')?.CurrentHolding).toBe(1_200_000);
    expect(merged.H000273.find((r) => r.Ticker === 'NVDA')).toBeUndefined();
    expect(merged.C001114[0].CurrentHolding).toBe(50_000);
  });
});
