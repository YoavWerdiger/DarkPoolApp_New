/** כמה סימולים ייחודיים נשלפים לפיד (Finnhub ~60/min). */
export const FEED_QUOTE_SYMBOL_CAP = 40;

export function uniqueFeedTickers(
  tickers: Array<string | null | undefined>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tickers) {
    const t =
      typeof raw === 'string' ? raw.trim().toUpperCase().replace(/^\$/, '') : '';
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= FEED_QUOTE_SYMBOL_CAP) break;
  }
  return out;
}
