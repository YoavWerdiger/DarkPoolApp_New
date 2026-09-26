/**
 * מיקרוקופי כנות למסך פרטי עסקה — מאחורי `?`, לא כפסקה בדף.
 */

import {
  CONGRESS_TRADE_HONESTY_BODY,
  CONGRESS_TRADE_HONESTY_TITLE,
  INSIDER_TRADE_HONESTY_BODY,
  INSIDER_TRADE_HONESTY_TITLE,
  TRADE_DETAIL_HONESTY_A11Y,
  TRADE_DETAIL_HONESTY_GOT_IT,
} from '../../screens/DarkPool/utils/tradeDetailHonestyCopy';

describe('tradeDetailHonestyCopy', () => {
  it('keeps a quiet control label and a got-it close', () => {
    expect(TRADE_DETAIL_HONESTY_A11Y).toBe('על המספרים במסך');
    expect(TRADE_DETAIL_HONESTY_GOT_IT).toBe('הבנתי');
    expect(CONGRESS_TRADE_HONESTY_TITLE).toBe('על המספרים');
    expect(INSIDER_TRADE_HONESTY_TITLE).toBe('על המספרים');
  });

  it('explains STOCK Act ranges without reconstructing a book', () => {
    expect(CONGRESS_TRADE_HONESTY_BODY).toMatch(/STOCK Act/);
    expect(CONGRESS_TRADE_HONESTY_BODY).toMatch(/טווח/);
    expect(CONGRESS_TRADE_HONESTY_BODY).toMatch(/מאז העסקה/);
    expect(CONGRESS_TRADE_HONESTY_BODY).not.toMatch(/משחזרים את התיק/);
  });

  it('explains Form 4 value as shares×price and does not invent open market', () => {
    expect(INSIDER_TRADE_HONESTY_BODY).toMatch(/Form 4/);
    expect(INSIDER_TRADE_HONESTY_BODY).toMatch(/מכפל/);
    expect(INSIDER_TRADE_HONESTY_BODY).toMatch(/ציטוט חי/);
    expect(INSIDER_TRADE_HONESTY_BODY).toMatch(/10b5-1/);
    expect(INSIDER_TRADE_HONESTY_BODY).toMatch(/לא הוכחה לשוק פתוח/);
    expect(INSIDER_TRADE_HONESTY_BODY).not.toMatch(/רכישה בשוק/);
  });
});
