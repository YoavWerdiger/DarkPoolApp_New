import {
  buildFeedTradeHeadline,
  formatFeedTickerBare,
  formatFeedTickerDisplay,
  formatFeedTradeDetail,
  getFeedTradeActionSentence,
  getFeedTradeDetailParts,
  getFeedTradeSide,
  getFeedTradeVerb,
  parseFeedShareCountLabel,
  resolveFeedInsiderShares,
  stripFeedBidiMarks,
  withFeedRangeLabel,
  withFeedValueLabel,
} from '../../screens/DarkPool/utils/feedTradeDisplay';
import { isolateData } from '../../screens/DarkPool/utils/bidi';

const LRI = '\u2066';

describe('getFeedTradeVerb', () => {
  // הפועל קוצר ל"קנה"/"מכר" כדי למנוע גלישת טקסט בכרטיסי הפיד.
  it('returns קנה / מכר', () => {
    expect(getFeedTradeVerb('buy')).toBe('קנה');
    expect(getFeedTradeVerb('sell')).toBe('מכר');
  });
});

describe('withFeedValueLabel', () => {
  it('prefixes בשווי:', () => {
    expect(withFeedValueLabel('$1.20M')).toBe('בשווי: $1.20M');
    expect(withFeedValueLabel('$50K–$100K')).toBe('בשווי: $50K–$100K');
  });

  it('does not duplicate בשווי', () => {
    expect(withFeedValueLabel('בשווי: $1.20M')).toBe('בשווי: $1.20M');
    expect(withFeedValueLabel('בשווי $1.20M')).toBe('בשווי: $1.20M');
  });
});

describe('withFeedRangeLabel', () => {
  it('prefixes בטווח:', () => {
    expect(withFeedRangeLabel('$15K–$50K')).toBe('בטווח: $15K–$50K');
    expect(withFeedRangeLabel('$1,001–$15,000')).toBe('בטווח: $1,001–$15,000');
  });

  it('does not duplicate בטווח and rewrites בשווי on a range', () => {
    expect(withFeedRangeLabel('בטווח: $15K–$50K')).toBe('בטווח: $15K–$50K');
    expect(withFeedRangeLabel('בשווי: $15K–$50K')).toBe('בטווח: $15K–$50K');
  });
});

describe('getFeedTradeDetailParts', () => {
  it('labels valueUsd with בשווי:', () => {
    expect(getFeedTradeDetailParts({ valueUsd: 1_200_000 })).toEqual({
      sharesLabel: null,
      amountLabel: 'בשווי: $1.20M',
    });
  });

  it('labels disclosure range with בטווח:', () => {
    expect(
      getFeedTradeDetailParts({ amountLabel: '$1,001 - $15,000' })
    ).toEqual({
      sharesLabel: null,
      amountLabel: 'בטווח: $1,001–$15,000',
    });
  });

  it('keeps shares separate from amount', () => {
    expect(
      getFeedTradeDetailParts({ shares: 1500, valueUsd: 50_000 })
    ).toEqual({
      sharesLabel: '1,500 מניות',
      amountLabel: 'בשווי: $50,000',
    });
  });
});

describe('formatFeedTradeDetail', () => {
  it('joins shares and labeled amount', () => {
    expect(
      formatFeedTradeDetail({ shares: 100, valueUsd: 12_000 })
    ).toBe('100 מניות · בשווי: $12,000');
  });
});

describe('formatFeedTickerDisplay', () => {
  it('prefixes $ and uppercases', () => {
    expect(formatFeedTickerDisplay('aapl')).toBe('$AAPL');
    expect(formatFeedTickerDisplay('NVDA')).toBe('$NVDA');
  });

  it('does not double $', () => {
    expect(formatFeedTickerDisplay('$tsla')).toBe('$TSLA');
    expect(formatFeedTickerDisplay('$AAPL')).toBe('$AAPL');
  });

  it('returns empty for blank', () => {
    expect(formatFeedTickerDisplay('')).toBe('');
    expect(formatFeedTickerDisplay('   ')).toBe('');
  });
});

describe('formatFeedTickerBare', () => {
  it('strips $ for the nested logo row', () => {
    expect(formatFeedTickerBare('$PG')).toBe('PG');
    expect(formatFeedTickerBare('wulf')).toBe('WULF');
  });
});

describe('getFeedTradeActionSentence', () => {
  it('builds קנה את / מכר את with $ticker', () => {
    expect(getFeedTradeActionSentence('buy', 'aapl')).toBe('קנה את $AAPL');
    expect(getFeedTradeActionSentence('sell', 'TSLA')).toBe('מכר את $TSLA');
  });

  it('does not double $ on ticker', () => {
    expect(getFeedTradeActionSentence('buy', '$nvda')).toBe('קנה את $NVDA');
  });
});

describe('buildFeedTradeHeadline', () => {
  it('congress uses the disclosed STOCK Act range, never shares', () => {
    const h = buildFeedTradeHeadline({
      side: 'buy',
      ticker: 'PG',
      kind: 'congress',
      amountRange: '$1,001 - $15,000',
    });
    expect(h.connector).toBe('range');
    expect(h.amountText).toBe('$1,001–$15,000');
    expect(h.sentence).toBe('קנה $1,001–$15,000 ב-$PG');
    expect(h.sentence).not.toMatch(/מניות/);
    expect(h.sentence).not.toContain(LRI);
    expect(isolateData(h.sentence)).toBe(h.sentence);
  });

  it('congress ignores a share count so we never invent Form 4 qty', () => {
    const h = buildFeedTradeHeadline({
      side: 'sell',
      ticker: 'NVDA',
      kind: 'congress',
      amountRange: '$15,001–$50,000',
      shares: 14000,
      valueUsd: 14_600,
    });
    expect(h.sentence).toBe('מכר $15,001–$50,000 ב-$NVDA');
    expect(h.sentence).not.toMatch(/מניות/);
    expect(h.connector).toBe('range');
  });

  it('congress falls back to קנה את $TICKER when the range is missing', () => {
    const h = buildFeedTradeHeadline({
      side: 'buy',
      ticker: 'PG',
      kind: 'congress',
    });
    expect(h.connector).toBe('bare');
    expect(h.sentence).toBe('קנה את $PG');
  });

  it('Form 4 uses the real share count', () => {
    const h = buildFeedTradeHeadline({
      side: 'buy',
      ticker: 'WULF',
      kind: 'insider',
      shares: 6085,
    });
    expect(h.connector).toBe('shares');
    expect(h.sentence).toBe('קנה 6,085 מניות של $WULF');
    expect(h.sentence).not.toContain(LRI);
  });

  it('Form 4 prefers exact shares over a dollar notional', () => {
    const h = buildFeedTradeHeadline({
      side: 'buy',
      ticker: 'NVDA',
      kind: 'insider',
      shares: 1000,
      valueUsd: 140_000,
    });
    expect(h.connector).toBe('shares');
    expect(h.sentence).toBe('קנה 1,000 מניות של $NVDA');
    expect(h.sentence).not.toMatch(/\$140/);
    expect(h.sentence).not.toMatch(/משוער|~/);
  });

  it('Form 4 uses exact value when shares are missing', () => {
    const h = buildFeedTradeHeadline({
      side: 'sell',
      ticker: 'AAPL',
      kind: 'insider',
      valueUsd: 50_000,
    });
    expect(h.connector).toBe('value');
    expect(h.sentence).toBe('מכר $50,000 ב-$AAPL');
    expect(h.sentence).not.toMatch(/מניות/);
  });

  it('strips בטווח: / LRI from a pre-labeled range', () => {
    const h = buildFeedTradeHeadline({
      side: 'buy',
      ticker: 'PG',
      kind: 'congress',
      amountRange: `בטווח: ${LRI}$1,001–$15,000\u2069`,
    });
    expect(h.amountText).toBe('$1,001–$15,000');
    expect(h.sentence).toBe('קנה $1,001–$15,000 ב-$PG');
  });
});

describe('parseFeedShareCountLabel', () => {
  it('reads Form 4 share labels from the following feed', () => {
    expect(parseFeedShareCountLabel('2,400 מניות')).toBe(2400);
    expect(parseFeedShareCountLabel('6085 מניות')).toBe(6085);
  });

  it('does not treat a STOCK Act dollar range as a share count', () => {
    expect(parseFeedShareCountLabel('$1,001 - $15,000')).toBeNull();
    expect(parseFeedShareCountLabel('בטווח: $15K–$50K')).toBeNull();
  });
});

describe('resolveFeedInsiderShares', () => {
  it('prefers the numeric Form 4 count over a leftover label', () => {
    expect(resolveFeedInsiderShares({ shares: 1000, sharesLabel: 'בשווי: $140,000' })).toBe(
      1000
    );
    expect(resolveFeedInsiderShares({ shares: 6085 })).toBe(6085);
  });

  it('falls back to a «N מניות» label when the number is missing', () => {
    expect(resolveFeedInsiderShares({ sharesLabel: '2,400 מניות' })).toBe(2400);
  });

  it('never invents qty from a STOCK Act range or a dollar notional', () => {
    expect(resolveFeedInsiderShares({ sharesLabel: '$1,001–$15,000' })).toBeNull();
    expect(resolveFeedInsiderShares({ sharesLabel: 'בשווי: $50,000' })).toBeNull();
    expect(resolveFeedInsiderShares({ shares: 0, sharesLabel: 'בטווח: $15K–$50K' })).toBeNull();
  });
});

describe('stripFeedBidiMarks', () => {
  it('removes LRI/PDI so a range can be re-isolated as data', () => {
    expect(stripFeedBidiMarks(`${LRI}$PG\u2069`)).toBe('$PG');
  });
});

describe('getFeedTradeSide', () => {
  it('detects sell variants', () => {
    expect(getFeedTradeSide('S')).toBe('sell');
    expect(getFeedTradeSide('sell')).toBe('sell');
    expect(getFeedTradeSide('מכירה')).toBe('sell');
  });

  it('defaults to buy', () => {
    expect(getFeedTradeSide('P')).toBe('buy');
    expect(getFeedTradeSide('purchase')).toBe('buy');
  });
});
