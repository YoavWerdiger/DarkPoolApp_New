import {
  congressTradeDetailParams,
  followingActivityToTradeDetail,
  hasTradeDetailPayload,
  insiderTradeDetailParams,
  profileRecentToTradeDetail,
  serializeCongressTrade,
  serializeInsiderTrade,
} from '../../screens/DarkPool/utils/tradeDetailParams';
import type { CongressFeedTrade } from '../../services/darkpool/uwCongressFeedService';
import type { FollowingActivityItem } from '../../services/darkpool/uwFollowingFeedService';
import type { InsiderBuyRow } from '../../types/darkpool.types';

function congress(over: Partial<CongressFeedTrade> = {}): CongressFeedTrade {
  return {
    id: 'c1',
    politician_id: 'P000197',
    politician_name: 'Nancy Pelosi',
    politician_image_url: null,
    ticker: 'nvda',
    company_name: 'NVIDIA',
    transaction_type: 'buy',
    shares: 123, // חייב להיזרק — STOCK Act לא מכיל כמות
    price: 45,
    amount_label: '$15,001 - $50,000',
    filed_at: '2026-08-14',
    transaction_date: '2026-07-28',
    txn_label: 'רכישה',
    source: 'quiverquant',
    excess_return_pct: 4.2,
    price_change_pct: 12.5,
    spy_change_pct: 8.3,
    ...over,
  };
}

function insider(over: Partial<InsiderBuyRow> = {}): InsiderBuyRow {
  return {
    id: 'i1',
    external_id: null,
    ticker: 'aapl',
    company_name: 'Apple',
    insider_name: 'Tim Cook',
    insider_role: 'CEO',
    transaction_type: 'P',
    shares: 1500,
    price: 207.41,
    value: 311_115,
    filed_at: '2026-09-01',
    transaction_date: '2026-08-28',
    source: 'form4',
    created_at: '2026-09-01',
    ...over,
  };
}

describe('serializeCongressTrade', () => {
  it('keeps the disclosed range and Quiver returns; drops invented shares/price', () => {
    const out = serializeCongressTrade(congress());
    expect(out.amount_label).toBe('$15,001 - $50,000');
    expect(out.filed_at).toBe('2026-08-14');
    expect(out.transaction_date).toBe('2026-07-28');
    expect(out.price_change_pct).toBe(12.5);
    expect(out.excess_return_pct).toBe(4.2);
    expect(out.shares).toBeNull();
    expect(out.price).toBeNull();
    expect(out.ticker).toBe('NVDA');
  });

  it('strips English/open-market txn labels down to רכישה/מכירה', () => {
    const out = serializeCongressTrade(
      congress({ txn_label: 'Open Market Purchase' })
    );
    expect(out.txn_label).toBe('רכישה');
    expect(out.txn_label).not.toMatch(/שוק|Open/i);
    expect(
      serializeCongressTrade(congress({ transaction_type: 'sell', txn_label: 'Sale' }))
        .txn_label
    ).toBe('מכירה');
  });

  it('does not invent 0% when returns are missing', () => {
    const out = serializeCongressTrade(
      congress({ price_change_pct: null, excess_return_pct: null, spy_change_pct: null })
    );
    expect(out.price_change_pct).toBeNull();
    expect(out.excess_return_pct).toBeNull();
    expect(out.spy_change_pct).toBeNull();
  });
});

describe('serializeInsiderTrade', () => {
  it('keeps shares, price and Form 4 code — never a strike', () => {
    const out = serializeInsiderTrade(insider());
    expect(out.shares).toBe(1500);
    expect(out.price).toBe(207.41);
    expect(out.transaction_type).toBe('P');
    expect(out).not.toHaveProperty('strike');
    expect(out).not.toHaveProperty('expiration');
  });

  it('preserves grant/gift codes instead of forcing buy/sell', () => {
    expect(serializeInsiderTrade(insider({ transaction_type: 'A' })).transaction_type).toBe(
      'A'
    );
    expect(serializeInsiderTrade(insider({ transaction_type: 'G' })).transaction_type).toBe(
      'G'
    );
    expect(serializeInsiderTrade(insider({ transaction_type: 'F' })).transaction_type).toBe(
      'F'
    );
  });
});

describe('followingActivityToTradeDetail', () => {
  const congressItem: FollowingActivityItem = {
    id: 'c:P000197:NVDA:2026-07-28:buy',
    source: 'congress',
    person_id: 'P000197',
    person_kind: 'politician',
    person_name: 'Nancy Pelosi',
    person_image_url: null,
    ticker: 'NVDA',
    issuer: 'NVIDIA',
    txn_label: 'רכישה',
    amount_label: '$1,001 - $15,000',
    activity_date: '2026-07-28',
    filed_label: 'לפני 12 ימים',
  };

  const insiderItem: FollowingActivityItem = {
    id: 'i:AAPL:Tim Cook:2026-08-28',
    source: 'insider',
    person_id: 'AAPL:Tim Cook',
    person_kind: 'insider',
    person_name: 'Tim Cook',
    person_image_url: null,
    ticker: 'AAPL',
    issuer: null,
    txn_label: 'מכירה',
    amount_label: '2,400 מניות',
    activity_date: '2026-08-28',
    filed_label: 'לפני 3 ימים',
  };

  it('maps a congress activity row to congress detail — range, no shares', () => {
    const params = followingActivityToTradeDetail(congressItem);
    expect(params?.kind).toBe('congress');
    if (params?.kind !== 'congress') return;
    expect(params.trade.amount_label).toBe('$1,001 - $15,000');
    expect(params.trade.shares).toBeNull();
    expect(params.trade.price_change_pct).toBeNull();
  });

  it('maps an insider activity row to Form 4 detail — shares, no fake price/strike', () => {
    const params = followingActivityToTradeDetail(insiderItem);
    expect(params?.kind).toBe('insider');
    if (params?.kind !== 'insider') return;
    expect(params.trade.shares).toBe(2400);
    expect(params.trade.price).toBe(0);
    expect(params.trade.transaction_type).toBe('S');
    expect(params.trade).not.toHaveProperty('strike');
  });

  it('does not invent Form 4 code P from a Hebrew רכישה label', () => {
    const params = followingActivityToTradeDetail({
      ...insiderItem,
      txn_label: 'רכישה',
    });
    expect(params?.kind).toBe('insider');
    if (params?.kind !== 'insider') return;
    expect(params.trade.transaction_type).not.toBe('P');
  });

  it('returns null when ticker is missing rather than falling back to a profile payload', () => {
    expect(
      followingActivityToTradeDetail({ ...congressItem, ticker: '' })
    ).toBeNull();
  });
});

describe('profileRecentToTradeDetail', () => {
  it('maps politician recent trades to congress detail', () => {
    const params = profileRecentToTradeDetail({
      personKind: 'politician',
      personId: 'P000197',
      personName: 'Nancy Pelosi',
      row: {
        id: 'r1',
        ticker: 'NVDA',
        txn_label: 'רכישה',
        amount_label: '$15,001 - $50,000',
        date: '2026-08-14',
        traded_date: '2026-07-28',
      },
    });
    expect(params?.kind).toBe('congress');
    if (params?.kind !== 'congress') return;
    expect(params.trade.filed_at).toBe('2026-08-14');
    expect(params.trade.transaction_date).toBe('2026-07-28');
    expect(params.trade.amount_label).toBe('$15,001 - $50,000');
  });

  it('refuses to pretend a 13F quarterly change is a trade', () => {
    expect(
      profileRecentToTradeDetail({
        personKind: 'fund_manager',
        personId: '1067983',
        personName: 'Berkshire Hathaway',
        row: {
          id: '13f1',
          ticker: 'AAPL',
          txn_label: 'הגדלת פוזיציה',
          amount_label: '+1.2M מניות',
          date: '2026-06-30',
        },
      })
    ).toBeNull();
  });
});

describe('hasTradeDetailPayload', () => {
  it('accepts serialized congress/insider params and rejects empty', () => {
    expect(hasTradeDetailPayload(congressTradeDetailParams(congress()))).toBe(true);
    expect(hasTradeDetailPayload(insiderTradeDetailParams(insider()))).toBe(true);
    expect(hasTradeDetailPayload(null)).toBe(false);
    expect(hasTradeDetailPayload(undefined)).toBe(false);
  });
});
