/**
 * משפט גיבור — פרטי עסקה וכרטיס הפיד (אותו JSX / אותה טיפוגרפיה).
 * המסך והפיד מרנדרים אותו בטופולוגיה: שם → פועל → קן טיקר.
 *
 * Form 4:
 *   קנה 21,000 מניות של $TFCO
 *   ב-$48.36 למניה בתאריך 17.09.2026
 *
 * קונגרס (טווח STOCK Act, בלי מניות):
 *   קנה $1,001–$15,000 ב-$PG
 *   בתאריך 08.09.2026
 *
 * התאריך הוא `transaction_date` בפורמט «בתאריך DD.MM.YYYY» — לא `· תאריך`
 * ולא שורה שלישית. הפועל צבעוני; השאר מעומעם. בלי LRI על המשפט. בלי «משוער».
 * מחיר 0 בהענקה/מימוש = אין «ב-$0 למניה».
 */

import { isolateData } from './bidi';
import {
  formatDisclosedAmountRange,
  formatTradeDate,
} from './congressTradeDisplay';
import {
  formatFeedTickerDisplay,
  getFeedTradeSide,
  getFeedTradeVerb,
} from './feedTradeDisplay';
import {
  describeInsiderCode,
  formatInsiderActionLead,
  formatInsiderPrice,
  formatInsiderShares,
  type InsiderTradeTone,
} from './insiderTradeDisplay';

export type TradeDetailSummary = {
  verb: string;
  /** שורה 1 אחרי הפועל — בלי טיקר מבודד, בלי LRI. */
  primary: string;
  /** שורה 1 אחרי הפועל — כמות/טווח + טיקר מבודדים. */
  primaryRender: string;
  /** שורה 2: `ב-$מחיר למניה בתאריך …` או `בתאריך …`. */
  metaLine: string | null;
  /** שורה 2 עם אי LTR רק על המחיר/תאריך. */
  metaRender: string | null;
  tickerDisplay: string;
  /** primary לתאימות לרנדר ישן. */
  rest: string;
  lines: string[];
  /** משפט מלא לטסטים / a11y — בלי סימני בידוד. */
  sentence: string;
  tone: InsiderTradeTone;
};

function datedMeta(
  lead: string | null,
  leadRender: string | null,
  transactionDate?: string | null
): { metaLine: string | null; metaRender: string | null } {
  const day = formatTradeDate(transactionDate);
  const dateBit = day ? `בתאריך ${day}` : null;
  const dateRender = day ? `בתאריך ${isolateData(day)}` : null;
  if (lead && dateBit) {
    return {
      metaLine: `${lead} ${dateBit}`,
      metaRender: `${leadRender} ${dateRender}`,
    };
  }
  if (dateBit) {
    return { metaLine: dateBit, metaRender: dateRender };
  }
  return { metaLine: lead, metaRender: leadRender };
}

function finishSummary(
  verb: string,
  primary: string,
  primaryRender: string,
  metaLine: string | null,
  metaRender: string | null,
  tickerDisplay: string,
  tone: InsiderTradeTone
): TradeDetailSummary {
  const line1 = `${verb} ${primary}`.replace(/\s+/g, ' ').trim();
  const lines = metaLine ? [line1, metaLine] : [line1];
  return {
    verb,
    primary,
    primaryRender,
    metaLine,
    metaRender,
    tickerDisplay,
    rest: primary,
    lines,
    sentence: lines.join(' '),
    tone,
  };
}

/**
 * קונגרס — טווח STOCK Act + טיקר בשורה 1; שורה 2 = `בתאריך`.
 * אין כמות מניות, אין מחיר למניה, אין midpoint, אין `· תאריך`.
 */
export function buildCongressTradeDetailSummary(input: {
  transactionType: string;
  ticker: string;
  amountLabel?: string | null;
  /** `transaction_date` — מוצג כ«בתאריך DD.MM.YYYY». */
  transactionDate?: string | null;
}): TradeDetailSummary {
  const side = getFeedTradeSide(input.transactionType);
  const verb = getFeedTradeVerb(side);
  const tickerDisplay = formatFeedTickerDisplay(input.ticker);
  const range = formatDisclosedAmountRange(input.amountLabel);
  const { metaLine, metaRender } = datedMeta(
    null,
    null,
    input.transactionDate
  );

  if (range) {
    const primary = tickerDisplay ? `${range} ב-${tickerDisplay}` : range;
    const primaryRender = tickerDisplay
      ? `${isolateData(range)} ב-${isolateData(tickerDisplay)}`
      : isolateData(range);
    return finishSummary(
      verb,
      primary,
      primaryRender,
      metaLine,
      metaRender,
      tickerDisplay,
      side
    );
  }

  const primary = tickerDisplay ? `את ${tickerDisplay}` : '';
  const primaryRender = tickerDisplay
    ? `את ${isolateData(tickerDisplay)}`
    : '';
  return finishSummary(
    verb,
    primary,
    primaryRender,
    metaLine,
    metaRender,
    tickerDisplay,
    side
  );
}

/**
 * Form 4 — כמות + טיקר בשורה 1; מחיר למניה + בתאריך בשורה 2.
 */
export function buildInsiderTradeDetailSummary(input: {
  transactionType?: string | null;
  ticker: string;
  shares?: number | null;
  price?: number | null;
  /** `transaction_date` — מוצג כ«בתאריך DD.MM.YYYY» אחרי למניה. */
  transactionDate?: string | null;
}): TradeDetailSummary {
  const meaning = describeInsiderCode(input.transactionType);
  const verb = formatInsiderActionLead(meaning);
  const tickerDisplay = formatFeedTickerDisplay(input.ticker);
  const sharesText = formatInsiderShares(input.shares);
  const priceText = formatInsiderPrice(input.price);
  const isVerb = meaning.tone === 'buy' || meaning.tone === 'sell';

  let primary = '';
  let primaryRender = '';
  if (sharesText && tickerDisplay) {
    const qty = isolateData(sharesText);
    const ticker = isolateData(tickerDisplay);
    if (isVerb) {
      primary = `${sharesText} מניות של ${tickerDisplay}`;
      primaryRender = `${qty} מניות של ${ticker}`;
    } else {
      primary = `של ${sharesText} מניות של ${tickerDisplay}`;
      primaryRender = `של ${qty} מניות של ${ticker}`;
    }
  } else if (tickerDisplay) {
    const ticker = isolateData(tickerDisplay);
    if (isVerb) {
      primary = `את ${tickerDisplay}`;
      primaryRender = `את ${ticker}`;
    } else {
      primary = `ב-${tickerDisplay}`;
      primaryRender = `ב-${ticker}`;
    }
  }

  const priceLine = priceText ? `ב-${priceText} למניה` : null;
  const priceRender = priceText
    ? `ב-${isolateData(priceText)} למניה`
    : null;
  const { metaLine, metaRender } = datedMeta(
    priceLine,
    priceRender,
    input.transactionDate
  );
  return finishSummary(
    verb,
    primary,
    primaryRender,
    metaLine,
    metaRender,
    tickerDisplay,
    meaning.tone
  );
}

export type TradeDetailFieldIcon =
  | 'ticker'
  | 'amount'
  | 'shares'
  | 'price'
  | 'value'
  | 'traded'
  | 'filed';

export type TradeDetailFieldRow = {
  label: string;
  value: string;
  icon: TradeDetailFieldIcon;
  ltr?: boolean;
};

function pushIf(
  rows: TradeDetailFieldRow[],
  row: {
    label: string;
    value: string | null | undefined;
    icon: TradeDetailFieldIcon;
    ltr?: boolean;
  }
) {
  const v = row.value?.trim();
  if (!v) return;
  rows.push({ label: row.label, value: v, icon: row.icon, ltr: row.ltr });
}

/**
 * שורות «פרטי העסקה» במסך הפירוט בלבד.
 * בלי אות Form 4. «שווי אחזקה» = מכפלת כמות×מחיר; קונגרס מקבל טווח מדווח, לא midpoint.
 */
export function buildTradeDetailFieldRows(input: {
  isCongress: boolean;
  tickerSym: string;
  amountRange: string | null;
  shares: string | null;
  price: string | null;
  value: string | null;
  valueLabel: string | null;
  traded: string | null;
  filed: string | null;
}): TradeDetailFieldRow[] {
  const rows: TradeDetailFieldRow[] = [];
  if (input.isCongress) {
    pushIf(rows, { label: 'נייר ערך', value: input.tickerSym, icon: 'ticker', ltr: true });
    pushIf(rows, {
      label: 'סכום מדווח',
      value: input.amountRange,
      icon: 'amount',
      ltr: Boolean(input.amountRange?.startsWith('$')),
    });
  } else {
    pushIf(rows, { label: 'נייר ערך', value: input.tickerSym, icon: 'ticker', ltr: true });
    pushIf(rows, { label: 'כמות', value: input.shares, icon: 'shares', ltr: true });
    pushIf(rows, { label: 'מחיר למניה', value: input.price, icon: 'price', ltr: true });
    pushIf(rows, {
      label: input.valueLabel ?? 'שווי אחזקה',
      value: input.value,
      icon: 'value',
      ltr: true,
    });
  }
  pushIf(rows, { label: 'בוצע', value: input.traded, icon: 'traded', ltr: true });
  pushIf(rows, { label: 'נחשף', value: input.filed, icon: 'filed', ltr: true });
  return rows;
}
