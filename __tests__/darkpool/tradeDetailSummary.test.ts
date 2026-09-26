/**
 * משפט סיכום במסך פרטי עסקה ובכרטיס הפיד — פיצול שורות.
 *
 * Form 4:
 *   קנה 21,000 מניות של $TFCO
 *   ב-$48.36 למניה בתאריך 17.09.2026
 *
 * קונגרס:
 *   קנה $1,001–$15,000 ב-$PG
 *   בתאריך 08.09.2026
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { isolateData } from '../../screens/DarkPool/utils/bidi';
import { formatHebrewMonthDay } from '../../screens/DarkPool/utils/congressTradeDisplay';
import {
  buildCongressTradeDetailSummary,
  buildInsiderTradeDetailSummary,
  buildTradeDetailFieldRows,
} from '../../screens/DarkPool/utils/tradeDetailSummary';

const LRI = '\u2066';
const PDI = '\u2069';

describe('formatHebrewMonthDay', () => {
  it('matches InsiderWave "Sep 8" as 8 בספטמבר', () => {
    expect(formatHebrewMonthDay('2026-09-08')).toBe('8 בספטמבר');
    expect(formatHebrewMonthDay('2026-09-15')).toBe('15 בספטמבר');
    expect(formatHebrewMonthDay('2026-01-01')).toBe('1 בינואר');
  });

  it('accepts a timestamp and strips the leading zero on the day', () => {
    expect(formatHebrewMonthDay('2026-09-08T12:00:00Z')).toBe('8 בספטמבר');
  });

  it('returns null when the day cannot be parsed', () => {
    expect(formatHebrewMonthDay(null)).toBeNull();
    expect(formatHebrewMonthDay('nope')).toBeNull();
  });
});

describe('buildInsiderTradeDetailSummary', () => {
  it('splits Form 4 into qty line + price בתאריך on line 2', () => {
    const s = buildInsiderTradeDetailSummary({
      transactionType: 'P',
      ticker: 'PG',
      shares: 100,
      price: 145.58,
      transactionDate: '2026-09-08',
    });
    expect(s.verb).toBe('קנה');
    expect(s.tone).toBe('buy');
    expect(s.primary).toBe('100 מניות של $PG');
    expect(s.primary).not.toMatch(/ב-/);
    expect(s.metaLine).toBe('ב-$145.58 למניה בתאריך 08.09.2026');
    expect(s.metaLine?.startsWith('ב-')).toBe(true);
    expect(s.lines).toEqual([
      'קנה 100 מניות של $PG',
      'ב-$145.58 למניה בתאריך 08.09.2026',
    ]);
    expect(s.sentence).toBe(
      'קנה 100 מניות של $PG ב-$145.58 למניה בתאריך 08.09.2026'
    );
    expect(s.sentence).not.toMatch(/ · /);
    expect(s.sentence).not.toContain(LRI);
    expect(isolateData(s.sentence)).toBe(s.sentence);
    expect(s.primaryRender).toBe(
      `${LRI}100${PDI} מניות של ${LRI}$PG${PDI}`
    );
    expect(s.metaRender).toBe(
      `ב-${LRI}$145.58${PDI} למניה בתאריך ${LRI}08.09.2026${PDI}`
    );
    expect(s.primaryRender.startsWith(LRI + 'קנה')).toBe(false);
  });

  it('breaks the WULF hero before ב- and appends בתאריך on the same line', () => {
    const s = buildInsiderTradeDetailSummary({
      transactionType: 'P',
      ticker: 'WULF',
      shares: 6085,
      price: 14.78,
      transactionDate: '2026-09-15',
    });
    expect(s.lines).toEqual([
      'קנה 6,085 מניות של $WULF',
      'ב-$14.78 למניה בתאריך 15.09.2026',
    ]);
    expect(s.primary).not.toMatch(/ב-/);
    expect(s.metaLine).toBe('ב-$14.78 למניה בתאריך 15.09.2026');
    expect(s.sentence).toMatch(/בתאריך 15\.09\.2026/);
    expect(s.sentence).not.toMatch(/ · /);
  });

  it('uses מכר in red-tone for Form 4 S', () => {
    const s = buildInsiderTradeDetailSummary({
      transactionType: 'S',
      ticker: 'WULF',
      shares: 6085,
      price: 14.78,
      transactionDate: '2026-09-15',
    });
    expect(s.verb).toBe('מכר');
    expect(s.tone).toBe('sell');
    expect(s.lines).toEqual([
      'מכר 6,085 מניות של $WULF',
      'ב-$14.78 למניה בתאריך 15.09.2026',
    ]);
    expect(s.sentence).toBe(
      'מכר 6,085 מניות של $WULF ב-$14.78 למניה בתאריך 15.09.2026'
    );
  });

  it('omits ב-$0 למניה on a grant and still shows בתאריך', () => {
    const s = buildInsiderTradeDetailSummary({
      transactionType: 'A',
      ticker: 'WULF',
      shares: 6085,
      price: 0,
      transactionDate: '2026-09-15',
    });
    expect(s.verb).toBe('הענקה');
    expect(s.tone).toBe('neutral');
    expect(s.primary).toBe('של 6,085 מניות של $WULF');
    expect(s.metaLine).toBe('בתאריך 15.09.2026');
    expect(s.lines).toEqual([
      'הענקה של 6,085 מניות של $WULF',
      'בתאריך 15.09.2026',
    ]);
    expect(s.sentence).toBe(
      'הענקה של 6,085 מניות של $WULF בתאריך 15.09.2026'
    );
    expect(s.sentence).not.toMatch(/\$0/);
    expect(s.sentence).not.toMatch(/למניה| · /);
  });

  it('uses מימוש without inventing a market price', () => {
    const s = buildInsiderTradeDetailSummary({
      transactionType: 'M',
      ticker: 'NVDA',
      shares: 1200,
      price: 0,
      transactionDate: '2026-03-02',
    });
    expect(s.verb).toBe('מימוש');
    expect(s.lines).toEqual([
      'מימוש של 1,200 מניות של $NVDA',
      'בתאריך 02.03.2026',
    ]);
    expect(s.sentence).not.toMatch(/\$0|למניה| · /);
  });

  it('keeps the TFCO hero as verb → qty → ticker, price + בתאריך on line 2', () => {
    const s = buildInsiderTradeDetailSummary({
      transactionType: 'P',
      ticker: 'TFCO',
      shares: 21000,
      price: 48.36,
      transactionDate: '2026-09-17',
    });
    expect(s.verb).toBe('קנה');
    expect(s.lines).toEqual([
      'קנה 21,000 מניות של $TFCO',
      'ב-$48.36 למניה בתאריך 17.09.2026',
    ]);
    expect(s.primaryRender).toBe(
      `${LRI}21,000${PDI} מניות של ${LRI}$TFCO${PDI}`
    );
    expect(s.metaRender).toBe(
      `ב-${LRI}$48.36${PDI} למניה בתאריך ${LRI}17.09.2026${PDI}`
    );
    expect(s.sentence).toBe(
      'קנה 21,000 מניות של $TFCO ב-$48.36 למניה בתאריך 17.09.2026'
    );
    expect(s.sentence).not.toMatch(/ · /);
  });

  it('does not take a live quote — missing filing price still shows בתאריך', () => {
    const s = buildInsiderTradeDetailSummary({
      transactionType: 'P',
      ticker: 'PG',
      shares: 100,
      price: null,
      transactionDate: '2026-09-08',
    });
    expect(s.lines).toEqual(['קנה 100 מניות של $PG', 'בתאריך 08.09.2026']);
    expect(s.sentence).not.toMatch(/145\.58|למניה| · /);
  });
});

describe('buildCongressTradeDetailSummary', () => {
  it('uses the STOCK Act range + ticker on line 1 and בתאריך on line 2', () => {
    const s = buildCongressTradeDetailSummary({
      transactionType: 'buy',
      ticker: 'PG',
      amountLabel: '$1,001 - $15,000',
      transactionDate: '2026-09-08',
    });
    expect(s.verb).toBe('קנה');
    expect(s.tone).toBe('buy');
    expect(s.primary).toBe('$1,001–$15,000 ב-$PG');
    expect(s.metaLine).toBe('בתאריך 08.09.2026');
    expect(s.lines).toEqual([
      'קנה $1,001–$15,000 ב-$PG',
      'בתאריך 08.09.2026',
    ]);
    expect(s.sentence).toBe('קנה $1,001–$15,000 ב-$PG בתאריך 08.09.2026');
    expect(s.sentence).not.toMatch(/מניות|למניה| · /);
    expect(s.sentence).not.toContain(LRI);
    expect(isolateData(s.sentence)).toBe(s.sentence);
    expect(s.primaryRender).toBe(
      `${LRI}$1,001–$15,000${PDI} ב-${LRI}$PG${PDI}`
    );
    expect(s.metaRender).toBe(`בתאריך ${LRI}08.09.2026${PDI}`);
  });

  it('sells with the disclosed range and does not invent a per-share price', () => {
    const s = buildCongressTradeDetailSummary({
      transactionType: 'sell',
      ticker: 'NVDA',
      amountLabel: '$15,001–$50,000',
      transactionDate: '2026-07-25',
    });
    expect(s.verb).toBe('מכר');
    expect(s.lines).toEqual([
      'מכר $15,001–$50,000 ב-$NVDA',
      'בתאריך 25.07.2026',
    ]);
    expect(s.sentence).not.toMatch(/מניות|למניה| · /);
  });

  it('falls back to ticker when the range cannot be parsed — date still on line 2', () => {
    const s = buildCongressTradeDetailSummary({
      transactionType: 'buy',
      ticker: 'PG',
      amountLabel: '$5,000',
      transactionDate: '2026-09-08',
    });
    expect(s.lines).toEqual(['קנה את $PG', 'בתאריך 08.09.2026']);
    expect(s.sentence).not.toMatch(/מניות| · /);
  });
});

describe('buildTradeDetailFieldRows', () => {
  it('drops the Form 4 letter row and labels shares×price as שווי אחזקה', () => {
    const rows = buildTradeDetailFieldRows({
      isCongress: false,
      tickerSym: '$WULF',
      amountRange: null,
      shares: '6,085',
      price: '$14.78',
      value: '$89,936',
      valueLabel: 'שווי אחזקה',
      traded: '15.09.2026',
      filed: '17.09.2026',
    });
    expect(rows.map((r) => r.label)).toEqual([
      'נייר ערך',
      'כמות',
      'מחיר למניה',
      'שווי אחזקה',
      'בוצע',
      'נחשף',
    ]);
    expect(rows.find((r) => r.label === 'שווי אחזקה')?.value).toBe('$89,936');
    expect(rows.some((r) => r.label === 'קוד')).toBe(false);
    expect(rows.some((r) => r.label === 'כמות × מחיר')).toBe(false);
  });

  it('shows the disclosed STOCK Act range and does not invent a holding value', () => {
    const rows = buildTradeDetailFieldRows({
      isCongress: true,
      tickerSym: '$PG',
      amountRange: '$1,001–$15,000',
      shares: null,
      price: null,
      value: null,
      valueLabel: null,
      traded: '08.09.2026',
      filed: '10.09.2026',
    });
    expect(rows.map((r) => r.label)).toEqual([
      'נייר ערך',
      'סכום מדווח',
      'בוצע',
      'נחשף',
    ]);
    expect(rows.find((r) => r.label === 'סכום מדווח')?.value).toBe(
      '$1,001–$15,000'
    );
    expect(rows.some((r) => r.label === 'שווי אחזקה')).toBe(false);
    expect(rows.some((r) => r.label === 'קוד')).toBe(false);
  });
});

describe('trade detail hero render', () => {
  it('renders isolated primary/meta and passes transaction_date into the summary', () => {
    const src = readFileSync(
      join(__dirname, '../../screens/DarkPool/DarkPoolTradeDetailScreen.tsx'),
      'utf8'
    );
    expect(src).toMatch(/summary\.primaryRender/);
    expect(src).toMatch(/summary\.metaRender/);
    expect(src).not.toMatch(/summary\.metaLine \?/);
    expect(src).toMatch(/transactionDate:\s*trade\?\.transaction_date/);
    expect(src).not.toMatch(/ · /);
  });

  it('puts name → sentence → nest in one outer UICard, not a second ticker card', () => {
    const src = readFileSync(
      join(__dirname, '../../screens/DarkPool/DarkPoolTradeDetailScreen.tsx'),
      'utf8'
    );
    const heroStart = src.indexOf('<UICard {...TRADE_HERO_UICARD}');
    const heroEnd = src.indexOf('</UICard>', heroStart);
    const name = src.indexOf('heroStyles.personName', heroStart);
    const action = src.indexOf('heroStyles.action', heroStart);
    const nest = src.indexOf('<DarkPoolNestedQuoteCard', heroStart);
    expect(heroStart).toBeGreaterThan(-1);
    expect(name).toBeGreaterThan(heroStart);
    expect(action).toBeGreaterThan(name);
    expect(nest).toBeGreaterThan(action);
    expect(nest).toBeLessThan(heroEnd);
    expect(src).toMatch(/heroStyles\.headerRow/);
    expect(src).toMatch(/heroStyles\.textCol/);
    expect(src).toMatch(/בתאריך/);
    expect(src).not.toMatch(/quoteHit/);
    expect(src).not.toMatch(/dateChips/);
  });
});

describe('trade detail nested quote glass', () => {
  it('uses UICard glass like the table, not a solid DarkPoolFeedNestedCard pill', () => {
    const src = readFileSync(
      join(
        __dirname,
        '../../screens/DarkPool/components/DarkPoolNestedQuoteCard.tsx'
      ),
      'utf8'
    );
    expect(src).toMatch(/<UICard[\s\S]*variant="glass"/);
    expect(src).toMatch(/glassIntensity="light"/);
    expect(src).toMatch(/FEED_NESTED_RADIUS/);
    expect(src).not.toMatch(/DarkPoolFeedNestedCard/);
  });

  it('pins live-price / מאז העסקה to the physical left of an LTR cluster', () => {
    const src = readFileSync(
      join(
        __dirname,
        '../../screens/DarkPool/components/DarkPoolNestedQuoteCard.tsx'
      ),
      'utf8'
    );
    expect(src).toMatch(/nestedPrice: \{[\s\S]*?direction: 'ltr'/);
    expect(src).toMatch(/nestedPrice: \{[\s\S]*?alignItems: 'flex-end'/);
    expect(src).toMatch(/nestedPriceLabel: \{[\s\S]*?textAlign: 'right'/);
    expect(src).toMatch(/nestedPriceValue: \{[\s\S]*?textAlign: 'right'/);
    expect(src).toMatch(/nestedSinceRow: \{[\s\S]*?direction: 'ltr'/);
    expect(src).toMatch(/nestedSinceRow: \{[\s\S]*?justifyContent: 'flex-end'/);
    expect(src).not.toMatch(/width: '100%'/);
    expect(src).not.toMatch(/flex: 1/);
  });
});
