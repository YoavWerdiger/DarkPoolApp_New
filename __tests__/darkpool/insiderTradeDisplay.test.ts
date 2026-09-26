/**
 * תצוגת עסקאות בכירים — קודי Form 4, כמות, מחיר ושווי.
 *
 * הטסטים מגנים על כללי הכנות:
 *   1. רק `P` הוא «רכישה בשוק». A/M/F/G לעולם לא.
 *   2. מחיר 0 בדיווח פירושו "אין מחיר" — לא "$0" ולא עסקה בשווי אפס.
 *   3. קוד שלא מוכר לנו מוצג כפי שהוא, בלי להמציא לו משמעות.
 *   4. תווית עברית «רכישה» בלי האות P לא הופכת לרכישה בשוק.
 */

import {
  describeInsiderCode,
  formatInsiderActionLead,
  formatInsiderPrice,
  formatInsiderRole,
  formatInsiderShares,
  formatInsiderValue,
  insiderTradeValueUsd,
  insiderValueFieldLabel,
  isForm4TransactionCode,
} from '../../screens/DarkPool/utils/insiderTradeDisplay';

describe('describeInsiderCode', () => {
  it('maps P/S to the same short verbs as the feed', () => {
    expect(describeInsiderCode('P')).toEqual({
      code: 'P',
      label: 'קנה',
      tone: 'buy',
    });
    expect(describeInsiderCode('S')).toEqual({
      code: 'S',
      label: 'מכר',
      tone: 'sell',
    });
    expect(describeInsiderCode('P').label).not.toMatch(/שוק|הפתוח/);
  });

  it('never calls a grant, exercise, gift or tax share a market purchase', () => {
    for (const code of ['A', 'M', 'F', 'G', 'D', 'J', 'C', 'X', 'I']) {
      const meaning = describeInsiderCode(code);
      expect(meaning.tone).toBe('neutral');
      expect(meaning.label).not.toMatch(/שוק/);
    }
    expect(describeInsiderCode('A').label).toBe('הענקה');
    expect(describeInsiderCode('M').label).toBe('מימוש');
    expect(describeInsiderCode('F').label).toBe('גריעת מס');
    expect(describeInsiderCode('G').label).toBe('מתנה');
  });

  it('never labels anything as a planned 10b5-1 sale', () => {
    const labels = ['P', 'S', 'A', 'M', 'F', 'G', 'D', 'J', 'C', 'X', 'I', 'O'].map(
      (c) => describeInsiderCode(c).label
    );
    for (const label of labels) {
      expect(label).not.toMatch(/מתוכננ|10b5/);
    }
  });

  it('does not claim the person chose the tax withholding', () => {
    const f = describeInsiderCode('F');
    expect(f.label).toBe('גריעת מס');
    expect(f.label).not.toMatch(/בחר|החליט|מכר/);
  });

  it('shows an unknown code as-is instead of inventing a meaning', () => {
    expect(describeInsiderCode('Z')).toEqual({
      code: 'Z',
      label: 'עסקה שדווחה בקוד Z',
      tone: 'neutral',
    });
    expect(describeInsiderCode('  p  ').code).toBe('P');
    expect(describeInsiderCode(null).code).toBe('');
  });

  it('does not treat a Hebrew רכישה label as Form 4 code P', () => {
    expect(describeInsiderCode('רכישה')).toEqual({
      code: '',
      label: 'קנה',
      tone: 'buy',
    });
    expect(describeInsiderCode('רכישה').label).not.toMatch(/שוק/);
    expect(isForm4TransactionCode('רכישה')).toBe(false);
    expect(isForm4TransactionCode('P')).toBe(true);
  });
});

describe('formatInsiderActionLead', () => {
  it('uses קנה / מכר for P and S', () => {
    expect(formatInsiderActionLead(describeInsiderCode('P'))).toBe('קנה');
    expect(formatInsiderActionLead(describeInsiderCode('S'))).toBe('מכר');
  });

  it('keeps grant language off the buy/sell verbs', () => {
    expect(formatInsiderActionLead(describeInsiderCode('A'))).toBe('הענקה');
    expect(formatInsiderActionLead(describeInsiderCode('G'))).toBe('מתנה');
    expect(formatInsiderActionLead(describeInsiderCode('BUY'))).toBe('קנה');
    expect(formatInsiderActionLead(describeInsiderCode('BUY'))).not.toMatch(/שוק/);
  });
});

describe('formatInsiderShares', () => {
  it('formats whole and fractional share counts', () => {
    expect(formatInsiderShares(45_723)).toBe('45,723');
    expect(formatInsiderShares(1523.944)).toBe('1,523.944');
  });

  it('reads the magnitude — direction comes from the code, not the sign', () => {
    expect(formatInsiderShares(-400_000)).toBe('400,000');
  });

  it('returns null for zero or missing', () => {
    expect(formatInsiderShares(0)).toBeNull();
    expect(formatInsiderShares(null)).toBeNull();
    expect(formatInsiderShares(Number.NaN)).toBeNull();
  });
});

describe('formatInsiderPrice', () => {
  it('formats a real reported price', () => {
    expect(formatInsiderPrice(207.41)).toBe('$207.41');
    expect(formatInsiderPrice(1234.5)).toBe('$1,234.50');
  });

  it('treats 0 as "no price in the filing", never "$0.00"', () => {
    expect(formatInsiderPrice(0)).toBeNull();
    expect(formatInsiderPrice(null)).toBeNull();
  });
});

describe('insiderTradeValueUsd / formatInsiderValue', () => {
  it('multiplies shares by price when both are real', () => {
    expect(insiderTradeValueUsd({ shares: 1000, price: 207.41 })).toBeCloseTo(207_410);
    expect(formatInsiderValue({ shares: 45_723, price: 207.41 })).toBe('$9.48M');
    expect(formatInsiderValue({ shares: 1000, price: 207.41 })).toBe('$207,410');
  });

  it('refuses to render $0 for a gift or grant', () => {
    expect(insiderTradeValueUsd({ shares: 400_000, price: 0, value: 0 })).toBeNull();
    expect(formatInsiderValue({ shares: 400_000, price: 0, value: 0 })).toBeNull();
  });

  it('prefers a reported positive value over recomputing', () => {
    expect(insiderTradeValueUsd({ shares: 10, price: 5, value: 999 })).toBe(999);
  });

  it('returns null when shares or price are missing', () => {
    expect(insiderTradeValueUsd({ shares: null, price: 207.41 })).toBeNull();
    expect(insiderTradeValueUsd({ shares: 100, price: null })).toBeNull();
  });
});

describe('insiderValueFieldLabel', () => {
  it('labels a filing shares×price product as שווי אחזקה', () => {
    expect(insiderValueFieldLabel({ shares: 5000, price: 50.55 })).toBe(
      'שווי אחזקה'
    );
    expect(insiderValueFieldLabel({ shares: 5000, price: 50.55 })).not.toBe(
      'כמות × מחיר'
    );
  });

  it('returns null when there is no value to show', () => {
    expect(insiderValueFieldLabel({ shares: 400_000, price: 0, value: 0 })).toBeNull();
  });
});

describe('formatInsiderRole', () => {
  it('returns null for the empty officer title Quiver sends in most rows', () => {
    expect(formatInsiderRole('')).toBeNull();
    expect(formatInsiderRole('   ')).toBeNull();
    expect(formatInsiderRole(null)).toBeNull();
    expect(formatInsiderRole('Chief Executive Officer')).toBe('Chief Executive Officer');
  });
});
