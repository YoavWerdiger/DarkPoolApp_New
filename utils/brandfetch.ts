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

const CRYPTO_PAIR_RE = /^([A-Z0-9]{2,10})(?:-(?:USD|USDT|USDC)|USDT|USDC)$/;

/**
 * URL ללוגו טיקר דרך Brandfetch CDN.
 * `icon` + `theme=light` — מונע לוגואים על רקע שחור מסביב.
 * נתיב מפורש `ticker/` (או `crypto/` לזוגות) — בלי זיהוי אוטומטי, שמחזיר מותג
 * אקראי עם אותו שם (למשל AIO → דמות אנימה במקום הקרן).
 * @see https://docs.brandfetch.com/logo-api/overview
 */
export function brandfetchTickerLogoUri(symbol: string): string | null {
  const s = normalizeTickerSymbol(symbol);
  if (!s || !BRANDFETCH_CLIENT_ID) return null;
  const q = new URLSearchParams({
    c: BRANDFETCH_CLIENT_ID,
    theme: 'light',
    fallback: 'lettermark',
  });
  const crypto = CRYPTO_PAIR_RE.exec(s);
  const route = crypto
    ? `crypto/${encodeURIComponent(crypto[1])}`
    : `ticker/${encodeURIComponent(s)}`;
  return `https://cdn.brandfetch.io/${route}/icon?${q.toString()}`;
}
