/** עזרי תצוגה משותפים לכרטיסי פיד — פעולה, טיקר, פירוט. */

import { formatInsiderShares } from './insiderTradeDisplay';

export type FeedTradeSide = 'buy' | 'sell';

export function getFeedTradeSide(transactionType: string): FeedTradeSide {
  const t = transactionType.trim().toLowerCase();
  if (
    t === 's' ||
    t === 'sell' ||
    t === 'sale' ||
    t === 'sold' ||
    t.includes('sell') ||
    t.includes('sale') ||
    t.includes('מכר') ||
    t.includes('מכיר')
  ) {
    return 'sell';
  }
  return 'buy';
}

/** פועל עבר קצר לשורת כותרת — «קנה» / «מכר», לא «רכישה בשוק הפתוח». */
export function getFeedTradeVerb(side: FeedTradeSide): string {
  return side === 'sell' ? 'מכר' : 'קנה';
}

/** תצוגת טיקר ב־UI בלבד — "$AAPL" בלי כפל `$`. */
export function formatFeedTickerDisplay(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  if (!t) return '';
  return t.startsWith('$') ? t : `$${t}`;
}

/** טיקר ליד הלוגו בכרטיס המקונן — בלי `$`, כמו InsiderWave. */
export function formatFeedTickerBare(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^\$/, '');
}

const BIDI_MARKS_RE = /[\u2066\u2069\u200e\u200f\u202a-\u202e]/g;

export function stripFeedBidiMarks(value: string): string {
  return value.replace(BIDI_MARKS_RE, '').trim();
}

function cleanAmountRange(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const stripped = stripFeedBidiMarks(raw)
    .replace(/^בטווח\s*:?\s*/u, '')
    .replace(/^בשווי\s*:?\s*/u, '')
    .trim();
  if (!stripped) return null;
  // «מעל $50,000,000» — לא להדביק `$` לפני עברית.
  if (/[\u0590-\u05FF]/.test(stripped)) return stripped;
  return formatFeedDisclosureRange(stripped);
}

/** משפט פעולה בלי סכום — נגיש יותר / נפילה כשחסר טווח. */
export function getFeedTradeActionSentence(
  side: FeedTradeSide,
  ticker: string
): string {
  const t = formatFeedTickerDisplay(ticker);
  return side === 'sell' ? `מכר את ${t}` : `קנה את ${t}`;
}

export type FeedHeadlineKind = 'congress' | 'insider';
export type FeedHeadlineConnector = 'range' | 'shares' | 'value' | 'bare';

export type FeedTradeHeadline = {
  verb: string;
  connector: FeedHeadlineConnector;
  /** טווח / כמות / שווי — בלי עברית ובלי LRI. */
  amountText: string | null;
  tickerDisplay: string;
  /** משפט מלא לטסטים/a11y — לעולם לא עטוף ב-LRI. */
  sentence: string;
};

/**
 * שורת הפעולה של כרטיס הפיד (מבנה InsiderWave, עברית).
 *
 * קונגרס: `קנה $1,001–$15,000 ב-$PG` — טווח STOCK Act בלבד, בלי «מניות».
 * Form 4: `קנה 6,085 מניות של $WULF` כשיש כמות אמיתית מהדיווח; לא «משוער».
 * כשיש גם שווי — הכמות מנצחת. לא midpoint(amount_label)/price.
 */
export function buildFeedTradeHeadline(input: {
  side: FeedTradeSide;
  ticker: string;
  kind: FeedHeadlineKind;
  amountRange?: string | null;
  shares?: number | null;
  valueUsd?: number | null;
}): FeedTradeHeadline {
  const verb = getFeedTradeVerb(input.side);
  const tickerDisplay = formatFeedTickerDisplay(input.ticker);

  if (input.kind === 'congress') {
    const range = cleanAmountRange(input.amountRange);
    if (range) {
      return {
        verb,
        connector: 'range',
        amountText: range,
        tickerDisplay,
        sentence: `${verb} ${range} ב-${tickerDisplay}`,
      };
    }
    return {
      verb,
      connector: 'bare',
      amountText: null,
      tickerDisplay,
      sentence: getFeedTradeActionSentence(input.side, input.ticker),
    };
  }

  if (input.shares != null && Number.isFinite(input.shares) && input.shares > 0) {
    const sharesText = formatInsiderShares(input.shares) ?? formatFeedShareCount(input.shares);
    return {
      verb,
      connector: 'shares',
      amountText: sharesText,
      tickerDisplay,
      sentence: `${verb} ${sharesText} מניות של ${tickerDisplay}`,
    };
  }

  if (input.valueUsd != null && Number.isFinite(input.valueUsd) && input.valueUsd > 0) {
    const valueText = formatFeedUsd(input.valueUsd);
    return {
      verb,
      connector: 'value',
      amountText: valueText,
      tickerDisplay,
      sentence: `${verb} ${valueText} ב-${tickerDisplay}`,
    };
  }

  return {
    verb,
    connector: 'bare',
    amountText: null,
    tickerDisplay,
    sentence: getFeedTradeActionSentence(input.side, input.ticker),
  };
}

/**
 * כמות Form 4 לפיד — המספר מהדיווח קודם, אחרת תווית «N מניות».
 * לא מפרסר טווח STOCK Act ולא ממציא midpoint.
 */
export function resolveFeedInsiderShares(input: {
  shares?: number | null;
  sharesLabel?: string | null;
}): number | null {
  if (input.shares != null && Number.isFinite(input.shares) && input.shares > 0) {
    return input.shares;
  }
  return parseFeedShareCountLabel(input.sharesLabel);
}

/** «2,400 מניות» מהפיד של מעקב — לא מטווח דולר. */
export function parseFeedShareCountLabel(
  raw: string | null | undefined
): number | null {
  if (!raw?.trim()) return null;
  const t = stripFeedBidiMarks(raw);
  if (!/מניות/u.test(t)) return null;
  if (/\$/.test(t)) return null;
  const n = Number(t.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function formatFeedUsd(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1000) {
    return `$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
  return `$${abs.toFixed(2)}`;
}

export function formatFeedShareCount(shares: number): string {
  const n = Math.abs(Math.round(shares));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return n.toLocaleString('en-US');
  return String(n);
}

/** טווח שווי STIR — "$1,001 - $15,000" → "$1,001–$15,000" */
export function formatFeedDisclosureRange(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const cleaned = raw.trim().replace(/\s*-\s*/g, '–').replace(/\s+/g, ' ');
  if (/^[0-9a-f-]{30,}$/i.test(cleaned)) return null;
  if (!/\$/.test(cleaned) && !/\d/.test(cleaned)) return null;
  return cleaned.startsWith('$') ? cleaned : `$${cleaned}`;
}

/** מוסיף "בשווי:" לפני סכום מדויק (Form 4) — בלי כפל אם כבר קיים. */
export function withFeedValueLabel(amount: string | null | undefined): string | null {
  if (!amount?.trim()) return null;
  const trimmed = amount.trim();
  if (/^בשווי\s*:?\s*/u.test(trimmed)) {
    const rest = trimmed.replace(/^בשווי\s*:?\s*/u, '').trim();
    return rest ? `בשווי: ${rest}` : null;
  }
  return `בשווי: ${trimmed}`;
}

/** טווח STOCK Act — «בטווח» ולא «בשווי», כי אין סכום מדויק. */
export function withFeedRangeLabel(amount: string | null | undefined): string | null {
  if (!amount?.trim()) return null;
  const trimmed = amount.trim();
  if (/^בטווח\s*:?\s*/u.test(trimmed)) {
    const rest = trimmed.replace(/^בטווח\s*:?\s*/u, '').trim();
    return rest ? `בטווח: ${rest}` : null;
  }
  if (/^בשווי\s*:?\s*/u.test(trimmed)) {
    const rest = trimmed.replace(/^בשווי\s*:?\s*/u, '').trim();
    return rest ? `בטווח: ${rest}` : null;
  }
  return `בטווח: ${trimmed}`;
}

export type FeedTradeDetailParts = {
  sharesLabel: string | null;
  amountLabel: string | null;
};

/** פירוק לפירוט כרטיס — כמות / שווי בנפרד כדי לסדר טיקר באמצע. */
export function getFeedTradeDetailParts(input: {
  shares?: number | null;
  valueUsd?: number | null;
  amountLabel?: string | null;
}): FeedTradeDetailParts {
  const sharesText =
    input.shares != null && input.shares > 0
      ? formatInsiderShares(input.shares) ?? formatFeedShareCount(input.shares)
      : null;
  const sharesLabel = sharesText ? `${sharesText} מניות` : null;

  let amountLabel: string | null = null;
  if (input.valueUsd != null && input.valueUsd > 0) {
    amountLabel = withFeedValueLabel(formatFeedUsd(input.valueUsd));
  } else {
    // טווח STOCK Act — «בטווח» ולא «בשווי», כי אין סכום מדויק
    amountLabel = withFeedRangeLabel(formatFeedDisclosureRange(input.amountLabel));
  }

  return { sharesLabel, amountLabel };
}

export function formatFeedTradeDetail(input: {
  shares?: number | null;
  valueUsd?: number | null;
  amountLabel?: string | null;
}): string | null {
  const { sharesLabel, amountLabel } = getFeedTradeDetailParts(input);
  const parts = [sharesLabel, amountLabel].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
