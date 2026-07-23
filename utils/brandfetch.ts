import { BRANDFETCH_CLIENT_ID } from '../config/publicEnv';

/** נרמול סימבול כמו במסכי חדשות (הסרת .US, מינוס מוביל וכו׳) */
export function normalizeTickerSymbol(symbol: string): string {
  let s = symbol.trim();
  s = s.replace(/\.US$/i, '');
  if (s.startsWith('-')) s = s.substring(1);
  s = s.trim().toUpperCase().replace(/\s+/g, '');
  s = s.replace(/[^A-Z0-9.\-]/g, '');
  return s;
}

/**
 * URL ללוגו טיקר דרך Brandfetch CDN (תמונה).
 * הפורמט תואם ל־`EarningsReportsTab` (ללא נתיב ‎/ticker/‎ שלא תואם לכל הסימבולים).
 * @see https://docs.brandfetch.com/
 */
export function brandfetchTickerLogoUri(symbol: string): string | null {
  const s = normalizeTickerSymbol(symbol);
  if (!s || !BRANDFETCH_CLIENT_ID) return null;
  return `https://cdn.brandfetch.io/${encodeURIComponent(s)}?c=${encodeURIComponent(BRANDFETCH_CLIENT_ID)}`;
}
