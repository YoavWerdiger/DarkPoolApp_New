import {
  formatFeedTickerDisplay,
  formatFeedTradeDetail,
  getFeedTradeActionSentence,
  getFeedTradeDetailParts,
  getFeedTradeSide,
  getFeedTradeVerb,
  withFeedValueLabel,
} from '../../screens/DarkPool/utils/feedTradeDisplay';

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

describe('getFeedTradeDetailParts', () => {
  it('labels valueUsd with בשווי:', () => {
    expect(getFeedTradeDetailParts({ valueUsd: 1_200_000 })).toEqual({
      sharesLabel: null,
      amountLabel: 'בשווי: $1.20M',
    });
  });

  it('labels disclosure range with בשווי:', () => {
    expect(
      getFeedTradeDetailParts({ amountLabel: '$1,001 - $15,000' })
    ).toEqual({
      sharesLabel: null,
      amountLabel: 'בשווי: $1,001–$15,000',
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

describe('getFeedTradeActionSentence', () => {
  it('builds קנה את / מכר את with $ticker', () => {
    expect(getFeedTradeActionSentence('buy', 'aapl')).toBe('קנה את $AAPL');
    expect(getFeedTradeActionSentence('sell', 'TSLA')).toBe('מכר את $TSLA');
  });

  it('does not double $ on ticker', () => {
    expect(getFeedTradeActionSentence('buy', '$nvda')).toBe('קנה את $NVDA');
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
