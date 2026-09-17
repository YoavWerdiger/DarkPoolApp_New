/** עזרי תצוגה משותפים לכרטיסי פיד — פעולה, טיקר, פירוט. */

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

/** פועל עבר קצר לשורת כותרת — "{שם} קנה את $NVDA" */
export function getFeedTradeVerb(side: FeedTradeSide): string {
  return side === 'sell' ? 'מכר' : 'קנה';
}

/** תצוגת טיקר ב־UI בלבד — "$AAPL" בלי כפל `$`. */
export function formatFeedTickerDisplay(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  if (!t) return '';
  return t.startsWith('$') ? t : `$${t}`;
}

/** משפט פעולה מלא — נגיש יותר */
export function getFeedTradeActionSentence(
  side: FeedTradeSide,
  ticker: string
): string {
  const t = formatFeedTickerDisplay(ticker);
  return side === 'sell' ? `מכר את ${t}` : `קנה את ${t}`;
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

/** מוסיף "בשווי:" לפני סכום — בלי כפל אם כבר קיים. */
export function withFeedValueLabel(amount: string | null | undefined): string | null {
  if (!amount?.trim()) return null;
  const trimmed = amount.trim();
  if (/^בשווי\s*:?\s*/u.test(trimmed)) {
    const rest = trimmed.replace(/^בשווי\s*:?\s*/u, '').trim();
    return rest ? `בשווי: ${rest}` : null;
  }
  return `בשווי: ${trimmed}`;
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
  const sharesLabel =
    input.shares != null && input.shares > 0
      ? `${formatFeedShareCount(input.shares)} מניות`
      : null;

  let amountLabel: string | null = null;
  if (input.valueUsd != null && input.valueUsd > 0) {
    amountLabel = formatFeedUsd(input.valueUsd);
  } else {
    // בלי "בטווח" — חוסך מקום בשורה הצפופה
    amountLabel = formatFeedDisclosureRange(input.amountLabel);
  }

  return { sharesLabel, amountLabel: withFeedValueLabel(amountLabel) };
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
