/** עזרי תצוגה משותפים לכרטיסי פיד — פעולה, טיקר, פירוט. */

export type FeedTradeSide = 'buy' | 'sell';

export function getFeedTradeSide(transactionType: string): FeedTradeSide {
  const t = transactionType.toLowerCase();
  if (t === 's' || t === 'sell') return 'sell';
  return 'buy';
}

export function getFeedTradeVerb(side: FeedTradeSide): string {
  return side === 'sell' ? 'מכר' : 'רכש';
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

export function formatFeedTradeDetail(input: {
  shares?: number | null;
  valueUsd?: number | null;
  amountLabel?: string | null;
}): string | null {
  const parts: string[] = [];

  if (input.shares != null && input.shares > 0) {
    parts.push(`${formatFeedShareCount(input.shares)} מניות`);
  }

  if (input.valueUsd != null && input.valueUsd > 0) {
    parts.push(formatFeedUsd(input.valueUsd));
  } else {
    const range = formatFeedDisclosureRange(input.amountLabel);
    if (range) parts.push(range);
  }

  return parts.length ? parts.join(' · ') : null;
}
