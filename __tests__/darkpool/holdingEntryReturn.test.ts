import { buildForm4Holdings } from '../../screens/DarkPool/utils/investorHoldings';
import {
  congressHonestHoldingReturnPct,
  extractQuiverHoldingVendorEntry,
  filingHoldingReturnPct,
  implied13FMarkPrice,
  quotesMapFromDailyCloses,
  replay13FAvgCost,
} from '../../screens/DarkPool/utils/holdingEntryReturn';

describe('Form 4 weighted average cost', () => {
  it('weights buys and reduces basis on sells', () => {
    const holdings = buildForm4Holdings(
      [
        { ticker: 'AAPL', transaction_date: '2024-01-05', transaction_code: 'P', shares: 100, price: 10 },
        { ticker: 'AAPL', transaction_date: '2024-02-05', transaction_code: 'P', shares: 100, price: 20 },
        { ticker: 'AAPL', transaction_date: '2024-03-05', transaction_code: 'S', shares: 50, price: 24 },
      ],
      new Map([['AAPL', 18]])
    );
    expect(holdings[0].exactShares).toBe(150);
    expect(holdings[0].avgCost).toBeCloseTo(15, 5);
    expect(holdings[0].entryReturnPct).toBeCloseTo(20, 5);
  });

  it('hides return without a live quote — last fill is not current price', () => {
    const holdings = buildForm4Holdings([
      { ticker: 'AAPL', transaction_date: '2024-01-05', transaction_code: 'P', shares: 100, price: 50 },
    ]);
    expect(holdings[0].avgCost).toBe(50);
    expect(holdings[0].sharePrice).toBe(50);
    expect(holdings[0].entryReturnPct).toBeNull();
  });
});

describe('13F value/shares mark', () => {
  it('uses last filing value/shares as the mark', () => {
    expect(implied13FMarkPrice(1_000_000, 10_000)).toBe(100);
    expect(filingHoldingReturnPct(110, 100)).toBeCloseTo(10);
    expect(filingHoldingReturnPct(110, null)).toBeNull();
  });

  it('accumulates added shares at later filing marks', () => {
    const pos = replay13FAvgCost([
      { filing_date: '2024-03-31', ticker: 'TSLA', shares: 100, value_usd: 10_000 },
      { filing_date: '2024-06-30', ticker: 'TSLA', shares: 150, value_usd: 18_000 },
    ]);
    const tsla = pos.get('TSLA');
    expect(tsla?.shares).toBe(150);
    expect(tsla?.lastMark).toBe(120);
    // 100 @ 100 + 50 @ 120 = 16_000 / 150
    expect(tsla?.avgCost).toBeCloseTo(16_000 / 150, 5);
    expect(filingHoldingReturnPct(150, tsla?.avgCost)).toBeCloseTo(
      (150 - 16_000 / 150) / (16_000 / 150) * 100,
      5
    );
  });

  it('falls back to last mark when only one filing exists', () => {
    const pos = replay13FAvgCost([
      { filing_date: '2024-06-30', ticker: 'COIN', shares: 80, value_usd: 12_000 },
    ]);
    expect(pos.get('COIN')?.avgCost).toBe(150);
  });

  it('does not invent a mark without shares or value', () => {
    expect(implied13FMarkPrice(1_000_000, null)).toBeNull();
    expect(replay13FAvgCost([{ filing_date: '2024-06-30', ticker: 'ARKK', shares: null, value_usd: 5_000 }]).size).toBe(
      0
    );
  });
});

describe('congress holdings — no fake entry', () => {
  const quiverLivePayload = {
    Name: 'Nancy Pelosi',
    Ticker: 'AAPL',
    Allocation: 0.118698678134969,
    BioGuideID: 'P000197',
    CurrentHolding: 18460942.4006494,
  };

  it('reads no cost/shares/PriceChange from the real 5-field payload', () => {
    expect(extractQuiverHoldingVendorEntry(quiverLivePayload)).toEqual({
      vendorAvgCost: null,
      vendorShares: null,
      vendorPriceChangePct: null,
    });
    expect(
      congressHonestHoldingReturnPct({
        currentHoldingUsd: quiverLivePayload.CurrentHolding,
        livePrice: 220,
      })
    ).toBeNull();
  });

  it('does not derive qty from a STOCK Act amount range', () => {
    const amountMidpoint = 8000;
    const yahoo = 200;
    const fakeShares = amountMidpoint / yahoo;
    expect(
      congressHonestHoldingReturnPct({
        currentHoldingUsd: 18_460_942,
        livePrice: yahoo,
      })
    ).toBeNull();
    expect(fakeShares).toBe(40);
  });

  it('uses vendor PurchasePrice vs live when Quiver actually sent it', () => {
    const vendor = extractQuiverHoldingVendorEntry({
      ...quiverLivePayload,
      PurchasePrice: 180,
    });
    expect(vendor.vendorAvgCost).toBe(180);
    expect(
      congressHonestHoldingReturnPct({
        vendorAvgCost: vendor.vendorAvgCost,
        currentHoldingUsd: quiverLivePayload.CurrentHolding,
        livePrice: 198,
      })
    ).toBeCloseTo(10);
  });

  it('uses CurrentHolding / vendor shares only when shares came from Quiver', () => {
    expect(
      congressHonestHoldingReturnPct({
        vendorShares: 100_000,
        currentHoldingUsd: 10_000_000,
        livePrice: 120,
      })
    ).toBeCloseTo(20);
  });

  it('can surface vendor PriceChange without calling it entry', () => {
    expect(
      congressHonestHoldingReturnPct({
        vendorPriceChangePct: 12.4,
      })
    ).toBeCloseTo(12.4);
  });
});

describe('quotesMapFromDailyCloses', () => {
  it('picks the latest close per ticker', () => {
    const map = quotesMapFromDailyCloses({
      AAPL: [
        { date: '2024-01-02', close: 100 },
        { date: '2024-06-03', close: 130 },
      ],
    });
    expect(map.get('AAPL')).toBe(130);
  });
});
