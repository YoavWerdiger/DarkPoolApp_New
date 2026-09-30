/**
 * איי LTR בתוך טקסט עברי.
 *
 * הכלל שנשבר בעבר: עטיפת מחרוזת **מעורבת** (עברית + מספר) ב-isolate הופכת את
 * כל המקטע ל-LTR ומזיזה את המילה העברית לצד הלא נכון — "בשווי: $15K–$50K"
 * נקרא "$15K–$50K :בשווי". LRI על שם אדם מלא הופך את סדר המילים ב-RN.
 * לכן `isolateData` עוטף רק טיקר / מספר / תאריך / אחוז.
 */

import {
  hebrewText,
  isolateData,
  isolateNumericRuns,
  ltrNameText,
  toDataIsland,
  tradeActivitySubtitleParts,
} from '../../screens/DarkPool/utils/bidi';
import { formatInsiderDisplayName } from '../../screens/DarkPool/utils/investorPlaceholder';
import {
  DARK_POOL_TYPE,
  darkPoolHebrewTitleStyle,
  darkPoolPhysicalLeftText,
  darkPoolPhysicalRightText,
  darkPoolSectionTitle,
  darkPoolSectionTitleStyle,
  darkPoolSectionSubtitleStyle,
  darkPoolTextRtl,
} from '../../screens/DarkPool/darkPoolLayout';
import { buildFeedTradeHeadline } from '../../screens/DarkPool/utils/feedTradeDisplay';
import { readFileSync } from 'fs';
import { join } from 'path';

const LRI = '\u2066';
const PDI = '\u2069';

describe('toDataIsland', () => {
  it('wraps a pure-data segment in LRI…PDI', () => {
    expect(toDataIsland('$NVDA')).toBe(`${LRI}$NVDA${PDI}`);
    expect(toDataIsland('25.07.2026')).toBe(`${LRI}25.07.2026${PDI}`);
    expect(toDataIsland(-3.2)).toBe(`${LRI}-3.2${PDI}`);
  });

  it('returns an empty string for a missing value', () => {
    expect(toDataIsland(null)).toBe('');
    expect(toDataIsland(undefined)).toBe('');
    expect(toDataIsland('   ')).toBe('');
  });
});

describe('isolateData', () => {
  it('isolates tickers, amounts, dates and percentages', () => {
    expect(isolateData('$NVDA')).toBe(`${LRI}$NVDA${PDI}`);
    expect(isolateData('$15K–$50K')).toBe(`${LRI}$15K–$50K${PDI}`);
    expect(isolateData('+24.1%')).toBe(`${LRI}+24.1%${PDI}`);
    expect(isolateData('+11.4%')).toBe(`${LRI}+11.4%${PDI}`);
    expect(isolateData('P')).toBe(`${LRI}P${PDI}`);
  });

  it('does not isolate an English person or firm name', () => {
    // LRI על שם מלא הופך את הסדר במסך — נקודה תועה מטופלת ב-ltrNameText, לא ב-isolate.
    expect(isolateData('Saba Capital Management, L.P.')).toBe(
      'Saba Capital Management, L.P.'
    );
    expect(isolateData('Bucella Michael C.')).toBe('Bucella Michael C.');
    expect(isolateData('Michael C. Bucella')).toBe('Michael C. Bucella');
    expect(isolateData('Michael C. Bucella')).not.toContain(LRI);
  });

  it('leaves a mixed Hebrew+number segment untouched', () => {
    // עטיפה כאן הייתה הופכת את סדר המילים בתוך המשפט העברי.
    expect(isolateData('בשווי: $15K–$50K')).toBe('בשווי: $15K–$50K');
    expect(isolateData('בטווח: $15K–$50K')).toBe('בטווח: $15K–$50K');
    expect(isolateData('נחשף לפני 22 שעות')).toBe('נחשף לפני 22 שעות');
    expect(isolateData('1,500 מניות')).toBe('1,500 מניות');
    expect(isolateData('קנה $WULF')).toBe('קנה $WULF');
  });

  it('leaves pure Hebrew untouched', () => {
    expect(isolateData('קונגרס')).toBe('קונגרס');
    expect(isolateData('סכום לא זמין')).toBe('סכום לא זמין');
  });

  it('never emits a stray isolate for a missing value', () => {
    expect(isolateData(null)).toBe('');
    expect(isolateData(undefined)).toBe('');
  });

  it('keeps the " · " separator outside the isolate', () => {
    // הפיסוק נשאר ניטרלי ויורש את כיוון הפסקה — בלי נקודה שנודדת לקצה הלא נכון.
    const line = ['בשווי: $15K–$50K', 'קונגרס'].map(isolateData).join(' · ');
    expect(line).toBe('בשווי: $15K–$50K · קונגרס');
    expect(line.startsWith(LRI)).toBe(false);
  });
});

describe('isolateNumericRuns', () => {
  it('wraps only numbers inside a Hebrew feed dates line', () => {
    const line = 'נחשף לפני 20 ש׳ · בוצע לפני יומיים';
    expect(isolateNumericRuns(line)).toBe(
      `נחשף לפני ${LRI}20${PDI} ש׳ · בוצע לפני יומיים`
    );
    expect(isolateData(line)).toBe(line);
  });

  it('does not wrap a pure Hebrew section title', () => {
    expect(isolateNumericRuns('עסקאות אחרונות')).toBe('עסקאות אחרונות');
    expect(isolateNumericRuns('מחיר חי')).toBe('מחיר חי');
    expect(isolateNumericRuns('מאז העסקה')).toBe('מאז העסקה');
  });
});

describe('formatInsiderDisplayName — Form 4 last-first', () => {
  it('turns Bucella Michael C. into Michael C. Bucella without isolates', () => {
    expect(formatInsiderDisplayName('Bucella Michael C.')).toBe('Michael C. Bucella');
    expect(formatInsiderDisplayName('Bucella Michael C')).toBe('Michael C. Bucella');
    expect(formatInsiderDisplayName('BUCELLA MICHAEL C.')).toBe('Michael C. Bucella');
    expect(formatInsiderDisplayName('Michael C. Bucella')).toBe('Michael C. Bucella');
    expect(formatInsiderDisplayName('Michael C. Bucella')).not.toContain(LRI);
  });

  it('still flips ALL CAPS last-first and leaves First Last / firms', () => {
    expect(formatInsiderDisplayName('MUSK ELON')).toBe('Elon Musk');
    expect(formatInsiderDisplayName('Nancy Pelosi')).toBe('Nancy Pelosi');
    expect(formatInsiderDisplayName('Saba Capital Management, L.P.')).toBe(
      'Saba Capital Management, L.P.'
    );
  });
});

describe('tradeActivitySubtitleParts', () => {
  it('keeps Hebrew sentence order; name un-isolated; ticker isolated', () => {
    const name = formatInsiderDisplayName('Bucella Michael C.');
    const parts = tradeActivitySubtitleParts(name, 'WULF');
    expect(parts.sentence).toBe('עסקאות נוספות של Michael C. Bucella ב-$WULF');
    expect(parts.sentence).not.toContain(LRI);
    expect(parts.sentence).not.toMatch(/WULF-ל|של עסקאות נוספות/);
    expect(parts.name).toBe('Michael C. Bucella');
    expect(parts.name).not.toContain(LRI);
    expect(parts.tickerDisplay).toBe('$WULF');
    expect(parts.tickerIsolated).toBe(`${LRI}$WULF${PDI}`);
    expect(isolateData(parts.sentence)).toBe(parts.sentence);
  });
});

describe('trade detail headline pieces', () => {
  it('does not LRI the Form 4 qty + price sentence', () => {
    const sentence = 'קנה 100 מניות של $PG ב-$145.58 למניה';
    expect(isolateData(sentence)).toBe(sentence);
    expect(sentence.startsWith(LRI)).toBe(false);
  });

  it('does not LRI a congress range sentence', () => {
    const sentence = 'קנה $1,001–$15,000 ב-$PG';
    expect(isolateData(sentence)).toBe(sentence);
    expect(sentence).not.toMatch(/מניות/);
  });
});

describe('global Dark Pool text primitives', () => {
  it('body copy is RTL + right-aligned, and layout reuses the same object', () => {
    expect(hebrewText).toMatchObject({
      textAlign: 'right',
      writingDirection: 'rtl',
    });
    expect(hebrewText.direction).toBeUndefined();
    expect(darkPoolTextRtl).toBe(hebrewText);
  });

  it('feed Hebrew title does not put direction:ltr on the Text node', () => {
    expect(darkPoolHebrewTitleStyle.direction).toBeUndefined();
    expect(darkPoolHebrewTitleStyle).toMatchObject({
      writingDirection: 'rtl',
      textAlign: 'right',
      fontSize: 20,
      fontWeight: '800',
    });
  });

  it('English names use LTR writing direction, not unicode isolates', () => {
    expect(ltrNameText).toMatchObject({
      direction: 'ltr',
      writingDirection: 'ltr',
      textAlign: 'right',
    });
  });

  it('section titles sit on the physical right inside an RTL tree', () => {
    // direction:'rtl' parent remaps textAlign:'right' → trailing (visual left).
    // The text box is LTR so `right` stays the right edge of the screen.
    expect(darkPoolPhysicalRightText).toMatchObject({
      direction: 'ltr',
      textAlign: 'right',
      writingDirection: 'rtl',
    });
    expect(darkPoolPhysicalLeftText).toMatchObject({
      direction: 'ltr',
      textAlign: 'left',
      writingDirection: 'ltr',
    });
    expect(darkPoolSectionTitle).toMatchObject({
      direction: 'ltr',
      textAlign: 'right',
      writingDirection: 'rtl',
      width: '100%',
    });
  });

  it('copies the working Explore type scale', () => {
    expect(DARK_POOL_TYPE.sectionTitle).toMatchObject({
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 26,
    });
    expect(DARK_POOL_TYPE.sectionSubtitle).toMatchObject({
      fontSize: 13,
      lineHeight: 18,
    });
    expect(DARK_POOL_TYPE.body).toMatchObject({
      fontSize: 15,
      lineHeight: 22,
    });
    expect(DARK_POOL_TYPE.footnote).toMatchObject({
      fontSize: 13,
      lineHeight: 18,
    });
    expect(DARK_POOL_TYPE.caption).toMatchObject({ fontSize: 12 });
    expect(DARK_POOL_TYPE.caption2).toMatchObject({ fontSize: 11 });
    expect(darkPoolSectionTitleStyle).toMatchObject({
      direction: 'ltr',
      textAlign: 'right',
      fontSize: 20,
      fontWeight: '800',
    });
    expect(darkPoolSectionSubtitleStyle).toMatchObject({
      direction: 'ltr',
      textAlign: 'right',
      fontSize: 13,
      lineHeight: 18,
    });
  });
});

describe('insider feed Hebrew — no direction:ltr on Text', () => {
  const cardSrc = readFileSync(
    join(__dirname, '../../screens/DarkPool/components/darkPoolFeedCardStyles.ts'),
    'utf8'
  );
  const feedCardSrc = readFileSync(
    join(__dirname, '../../screens/DarkPool/components/DarkPoolTradeFeedCard.tsx'),
    'utf8'
  );
  const nestSrc = readFileSync(
    join(__dirname, '../../screens/DarkPool/components/DarkPoolNestedQuoteCard.tsx'),
    'utf8'
  );
  const homeSrc = readFileSync(
    join(__dirname, '../../screens/DarkPool/DarkPoolHomeScreen.tsx'),
    'utf8'
  );

  it('dates / action sit on the physical right; live-price cluster is LTR left', () => {
    expect(cardSrc).toMatch(/dates: \{\s*\.\.\.darkPoolPhysicalRightText/);
    expect(cardSrc).toMatch(/action: \{\s*\.\.\.darkPoolPhysicalRightText/);
    expect(cardSrc).toMatch(/personHint: \{\s*\.\.\.darkPoolPhysicalRightText/);
    expect(cardSrc).toMatch(/actionMeta: \{\s*\.\.\.darkPoolPhysicalRightText/);
    expect(cardSrc).toMatch(/textCol: \{[\s\S]*?direction: 'ltr'/);
    expect(cardSrc).toMatch(/nestedPrice: \{[\s\S]*?direction: 'ltr'/);
    expect(cardSrc).toMatch(/nestedPrice: \{[\s\S]*?alignItems: 'flex-end'/);
    expect(cardSrc).toMatch(/nestedPriceLabel: \{[\s\S]*?textAlign: 'right'/);
    expect(cardSrc).toMatch(/nestedPriceValue: \{[\s\S]*?textAlign: 'right'/);
    expect(cardSrc).toMatch(/nestedSinceRow: \{[\s\S]*?direction: 'ltr'/);
    expect(cardSrc).toMatch(/nestedSinceLabel: \{[\s\S]*?writingDirection: 'rtl'/);
  });

  it('keeps ticker+logo as a non-shrinking cluster opposite the live price', () => {
    expect(cardSrc).toMatch(/nestedTicker: \{[\s\S]*?flexShrink: 0/);
    expect(cardSrc).toMatch(
      /nestedPrice: \{\s*direction: 'ltr',\s*alignItems: 'flex-end',\s*flexShrink: 1/
    );
    expect(cardSrc).not.toMatch(/maxWidth: '58%'/);
    expect(feedCardSrc).not.toMatch(/DarkPoolNestedQuoteCard/);
    expect(nestSrc).toMatch(/styles\.nestedTicker/);
    expect(nestSrc).toMatch(/styles\.nestedPrice/);
    expect(nestSrc).toMatch(/מאז העסקה/);
    expect(nestSrc).toMatch(/מחיר חי/);
  });

  it('HomeScreen section title uses the Hebrew title style inside an LTR box', () => {
    expect(homeSrc).toMatch(/עסקאות אחרונות/);
    expect(homeSrc).toMatch(/darkPoolHebrewTitleStyle/);
    expect(homeSrc).toMatch(/tradesHead: \{\s*direction: 'ltr'/);
    expect(homeSrc).not.toMatch(/sectionTitle: \{\s*\.\.\.darkPoolSectionTitleStyle/);
  });

  it('Form 4 action pieces isolate qty and ticker only', () => {
    const h = buildFeedTradeHeadline({
      side: 'buy',
      ticker: 'BRID',
      kind: 'insider',
      shares: 1000,
    });
    expect(h.sentence).toBe('קנה 1,000 מניות של $BRID');
    expect(isolateData(h.verb)).toBe('קנה');
    expect(isolateData(h.amountText)).toBe(`${LRI}1,000${PDI}`);
    expect(isolateData(' מניות של ')).toBe(' מניות של ');
    expect(isolateData(h.tickerDisplay)).toBe(`${LRI}$BRID${PDI}`);
    expect(isolateData(h.sentence)).toBe(h.sentence);
    expect(h.sentence).not.toMatch(/לקנה|של קנה|משוער/);
    expect(feedCardSrc).toMatch(/summary\.primaryRender/);
    expect(feedCardSrc).toMatch(/summary\.metaRender/);
    expect(feedCardSrc).toMatch(/buildInsiderTradeDetailSummary/);
  });
});
