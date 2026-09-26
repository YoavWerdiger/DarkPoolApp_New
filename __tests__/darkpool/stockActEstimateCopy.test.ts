/**
 * מיקרוקופי כנות STOCK Act — בלי לטעון שאנחנו משחזרים תיק מטווחים.
 */

import {
  STOCK_ACT_ESTIMATE_BODY,
  STOCK_ACT_ESTIMATE_GOT_IT,
  STOCK_ACT_ESTIMATE_LINK,
  STOCK_ACT_ESTIMATE_TITLE,
} from '../../screens/DarkPool/utils/stockActEstimateCopy';

describe('stockActEstimateCopy', () => {
  it('keeps the InsiderWave-style title and got-it, in Hebrew', () => {
    expect(STOCK_ACT_ESTIMATE_TITLE).toBe('למה הסכומים האלה הערכות');
    expect(STOCK_ACT_ESTIMATE_GOT_IT).toBe('הבנתי');
    expect(STOCK_ACT_ESTIMATE_LINK).toBe('למה אלה הערכות?');
  });

  it('says we show the disclosed range and Quiver holdings, not a reconstructed book', () => {
    expect(STOCK_ACT_ESTIMATE_BODY).toMatch(/STOCK Act/);
    expect(STOCK_ACT_ESTIMATE_BODY).toMatch(/\$1,001–\$15,000/);
    expect(STOCK_ACT_ESTIMATE_BODY).toMatch(/טווח/);
    expect(STOCK_ACT_ESTIMATE_BODY).toMatch(/Quiver/);
    expect(STOCK_ACT_ESTIMATE_BODY).toMatch(/BioGuide/);
    expect(STOCK_ACT_ESTIMATE_BODY).toMatch(/לא ממציאים כמות מניות/);
    expect(STOCK_ACT_ESTIMATE_BODY).toMatch(/לא משחזרים תיק/);
    expect(STOCK_ACT_ESTIMATE_BODY).toMatch(/מאז העסקה/);
    expect(STOCK_ACT_ESTIMATE_BODY).toMatch(/פתיחת יום הביצוע/);
    expect(STOCK_ACT_ESTIMATE_BODY).not.toMatch(/משחזרים את התיק/);
    expect(STOCK_ACT_ESTIMATE_BODY).not.toMatch(/reconstruct/i);
  });
});
