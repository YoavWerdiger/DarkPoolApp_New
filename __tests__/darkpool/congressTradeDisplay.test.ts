/**
 * תצוגת עסקאות קונגרס — תאריך כפול, טווח סכום מדווח, תשואה מ-Quiver.
 *
 * הטסטים מגנים על שני כללי הכנות המרכזיים:
 *   1. סכום מוצג כטווח מדווח בלבד — לא כסכום יחיד ולא כניחוש.
 *   2. חוסר נתון נשאר חוסר נתון (null / "לא זמין") ולא הופך ל-0.
 */

import {
  DARK_POOL_UNAVAILABLE,
  buildDualDateLine,
  disclosureDelayDays,
  formatCongressTxnLabel,
  formatDisclosedAmountRange,
  formatDisclosedAmountRangeCompact,
  formatDisclosureDelay,
  formatHebrewAgo,
  formatHebrewMonthDay,
  formatReturnPct,
  formatTradeDate,
  orUnavailable,
  parseDisclosedAmountRange,
  resolveFeedDatesLine,
  returnTone,
} from '../../screens/DarkPool/utils/congressTradeDisplay';

const NOW = Date.parse('2026-08-23T10:00:00Z');

describe('formatHebrewAgo', () => {
  it('uses hours under a day', () => {
    expect(formatHebrewAgo('2026-08-23T09:30:00Z', NOW)).toBe('לפני 30 דקות');
    expect(formatHebrewAgo('2026-08-22T12:00:00Z', NOW)).toBe('לפני 22 שעות');
  });

  it('uses Hebrew dual form for two', () => {
    expect(formatHebrewAgo('2026-08-23T08:00:00Z', NOW)).toBe('לפני שעתיים');
    expect(formatHebrewAgo('2026-08-21T10:00:00Z', NOW)).toBe('לפני יומיים');
    expect(formatHebrewAgo('2026-08-09T10:00:00Z', NOW)).toBe('לפני שבועיים');
  });

  it('switches to weeks, months and years', () => {
    expect(formatHebrewAgo('2026-07-25', NOW)).toBe('לפני 4 שבועות');
    expect(formatHebrewAgo('2026-05-23', NOW)).toBe('לפני 3 חודשים');
    expect(formatHebrewAgo('2023-08-23', NOW)).toBe('לפני 3 שנים');
  });

  it('returns null for an unparsable date instead of "לפני 0"', () => {
    expect(formatHebrewAgo(null, NOW)).toBeNull();
    expect(formatHebrewAgo('', NOW)).toBeNull();
    expect(formatHebrewAgo('not-a-date', NOW)).toBeNull();
  });

  it('compacts units so both feed dates fit on one line', () => {
    expect(formatHebrewAgo('2026-08-22T12:00:00Z', NOW, { compact: true })).toBe(
      'לפני 22 ש׳'
    );
    expect(formatHebrewAgo('2026-07-25', NOW, { compact: true })).toBe('לפני 4 שב׳');
  });
});

describe('buildDualDateLine', () => {
  // זה ההבדל המרכזי בין דיווח STOCK Act לעסקה רגילה — העיכוב בין הביצוע לדיווח.
  it('builds "נחשף … · בוצע …" from both dates', () => {
    const line = buildDualDateLine({
      filedAt: '2026-08-22T12:00:00Z',
      transactionDate: '2026-07-25',
      now: NOW,
    });
    expect(line.disclosed).toBe('נחשף לפני 22 שעות');
    expect(line.traded).toBe('בוצע לפני 4 שבועות');
    expect(line.text).toBe('נחשף לפני 22 שעות · בוצע לפני 4 שבועות');
  });

  it('keeps the single available side when the other date is missing', () => {
    const line = buildDualDateLine({
      filedAt: '2026-08-22T12:00:00Z',
      transactionDate: null,
      now: NOW,
    });
    expect(line.traded).toBeNull();
    expect(line.text).toBe('נחשף לפני 22 שעות');
  });

  it('returns null text when neither date is usable', () => {
    expect(
      buildDualDateLine({ filedAt: null, transactionDate: undefined, now: NOW }).text
    ).toBeNull();
  });

  it('collapses to one line when filed and traded are the same calendar day', () => {
    const line = buildDualDateLine({
      filedAt: '2026-07-25',
      transactionDate: '2026-07-25',
      now: NOW,
    });
    expect(line.traded).toBeNull();
    expect(line.text).toBe('בוצע ודווח לפני 4 שבועות');
    expect(line.text).not.toMatch(/נחשף/);
  });

  it('keeps compact dual dates on one feed line', () => {
    const line = buildDualDateLine({
      filedAt: '2026-08-22T12:00:00Z',
      transactionDate: '2026-07-25',
      now: NOW,
      compact: true,
    });
    expect(line.disclosed).toBe('נחשף לפני 22 ש׳');
    expect(line.traded).toBe('בוצע לפני 4 שב׳');
    expect(line.text).toBe('נחשף לפני 22 ש׳ · בוצע לפני 4 שב׳');
  });
});

describe('resolveFeedDatesLine', () => {
  it('prefers ISO dual dates over a single-side filed_label', () => {
    expect(
      resolveFeedDatesLine({
        filedAt: '2026-08-22T12:00:00Z',
        transactionDate: '2026-07-25',
        datesText: 'נחשף לפני 12 ימים',
        now: NOW,
      })
    ).toBe('נחשף לפני 22 ש׳ · בוצע לפני 4 שב׳');
  });

  it('keeps both sides when only the trade ISO and a disclosed label exist', () => {
    expect(
      resolveFeedDatesLine({
        filedAt: null,
        transactionDate: '2026-07-25',
        datesText: 'נחשף לפני 12 ימים',
        now: NOW,
      })
    ).toBe('נחשף לפני 12 ימים · בוצע לפני 4 שב׳');
  });

  it('falls back to datesText when no ISO dates parse', () => {
    expect(
      resolveFeedDatesLine({
        filedAt: null,
        transactionDate: null,
        datesText: 'נחשף לפני 12 ימים',
        now: NOW,
      })
    ).toBe('נחשף לפני 12 ימים');
  });
});

describe('formatCongressTxnLabel', () => {
  it('is buy/sell from the transaction type — never open-market wording', () => {
    expect(formatCongressTxnLabel('buy')).toBe('רכישה');
    expect(formatCongressTxnLabel('sell')).toBe('מכירה');
    expect(formatCongressTxnLabel('Purchase')).toBe('רכישה');
    expect(formatCongressTxnLabel('Purchase')).not.toMatch(/שוק/);
    expect(formatCongressTxnLabel('open market purchase')).not.toMatch(/שוק/);
  });
});

describe('disclosure delay', () => {
  it('counts days between traded and filed', () => {
    expect(disclosureDelayDays('2026-08-22T12:00:00Z', '2026-07-25')).toBe(28);
    expect(formatDisclosureDelay('2026-08-22T12:00:00Z', '2026-07-25')).toBe('28 ימים');
  });

  it('labels same-day and dual form', () => {
    expect(formatDisclosureDelay('2026-07-25T12:00:00Z', '2026-07-25')).toBe('אותו יום');
    expect(formatDisclosureDelay('2026-07-27T12:00:00Z', '2026-07-25')).toBe('יומיים');
  });

  it('returns null rather than 0 when a date is missing', () => {
    expect(disclosureDelayDays(null, '2026-07-25')).toBeNull();
    expect(formatDisclosureDelay('2026-08-22T12:00:00Z', null)).toBeNull();
  });
});

describe('parseDisclosedAmountRange', () => {
  it('keeps both reported bounds', () => {
    expect(parseDisclosedAmountRange('$15,001 - $50,000')).toEqual({
      low: 15_001,
      high: 50_000,
      source: 'reported',
    });
  });

  it('restores the STOCK Act bracket from a bare Quiver floor', () => {
    expect(parseDisclosedAmountRange('1001.0')).toEqual({
      low: 1_001,
      high: 15_000,
      source: 'bracket',
    });
    expect(parseDisclosedAmountRange('50001.0')).toEqual({
      low: 50_001,
      high: 100_000,
      source: 'bracket',
    });
  });

  it('marks the open-ended top bracket', () => {
    expect(parseDisclosedAmountRange('Over $50,000,000')).toEqual({
      low: 50_000_000,
      high: null,
      source: 'reported',
    });
  });

  it('refuses to invent a range from an unrecognised single number', () => {
    expect(parseDisclosedAmountRange('$5,000')).toBeNull();
  });

  it('ignores share labels and uuids', () => {
    expect(parseDisclosedAmountRange('1500 shares')).toBeNull();
    expect(
      parseDisclosedAmountRange('3f2504e0-4f89-11d3-9a0c-0305e82c3301')
    ).toBeNull();
    expect(parseDisclosedAmountRange(null)).toBeNull();
  });
});

describe('formatDisclosedAmountRange', () => {
  it('renders the disclosed range, never a midpoint', () => {
    expect(formatDisclosedAmountRange('$15,001 - $50,000')).toBe('$15,001–$50,000');
    expect(formatDisclosedAmountRange('1001.0')).toBe('$1,001–$15,000');
  });

  it('renders the open bracket as "מעל"', () => {
    expect(formatDisclosedAmountRange('Over $50,000,000')).toBe('מעל $50,000,000');
  });

  it('returns null when no range can be established', () => {
    expect(formatDisclosedAmountRange('$5,000')).toBeNull();
    expect(orUnavailable(formatDisclosedAmountRange('$5,000'))).toBe(
      DARK_POOL_UNAVAILABLE
    );
  });
});

describe('formatDisclosedAmountRangeCompact', () => {
  it('shortens the bracket for the feed row', () => {
    expect(formatDisclosedAmountRangeCompact('$15,001 - $50,000')).toBe('$15K–$50K');
    expect(formatDisclosedAmountRangeCompact('$1,000,001 - $5,000,000')).toBe(
      '$1M–$5M'
    );
    expect(formatDisclosedAmountRangeCompact('1001.0')).toBe('$1K–$15K');
  });
});

describe('formatReturnPct', () => {
  it('signs positive values and keeps two decimals like InsiderWave', () => {
    expect(formatReturnPct(24.11)).toBe('+24.11%');
    expect(formatReturnPct(-3.2)).toBe('-3.20%');
    expect(formatReturnPct(0.63)).toBe('+0.63%');
  });

  it('treats 0 as a real value but null as missing', () => {
    expect(formatReturnPct(0)).toBe('0.00%');
    expect(formatReturnPct(null)).toBeNull();
    expect(formatReturnPct(undefined)).toBeNull();
    expect(formatReturnPct(Number.NaN)).toBeNull();
  });

  it('maps tone without colouring a missing value', () => {
    expect(returnTone(24.11)).toBe('positive');
    expect(returnTone(-3.2)).toBe('negative');
    expect(returnTone(0)).toBe('neutral');
    expect(returnTone(null)).toBe('neutral');
  });
});

describe('formatTradeDate', () => {
  it('renders dd.mm.yyyy from a date or timestamp', () => {
    expect(formatTradeDate('2026-07-25')).toBe('25.07.2026');
    expect(formatTradeDate('2026-08-22T12:00:00Z')).toBe('22.08.2026');
  });

  it('returns null for missing input', () => {
    expect(formatTradeDate(null)).toBeNull();
    expect(formatTradeDate('nope')).toBeNull();
  });
});

describe('formatHebrewMonthDay', () => {
  it('renders InsiderWave-style day + Hebrew month', () => {
    expect(formatHebrewMonthDay('2026-09-08')).toBe('8 בספטמבר');
    expect(formatHebrewMonthDay('2026-07-25')).toBe('25 ביולי');
  });
});

describe('orUnavailable', () => {
  it('never renders an empty string as data', () => {
    expect(orUnavailable(null)).toBe('לא זמין');
    expect(orUnavailable('   ')).toBe('לא זמין');
    expect(orUnavailable('$1,001–$15,000')).toBe('$1,001–$15,000');
  });
});
