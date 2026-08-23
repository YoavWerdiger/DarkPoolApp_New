import { SUPABASE_URL } from '../../../config/publicEnv';
import { knownPortraitForInvestor } from './knownInvestorPortraits';

/** תמונת ברירת מחדל — שור/דוב (transback) מה-storage של האפליקציה. */
export const INVESTOR_PORTRAIT_PLACEHOLDER_URI = `${SUPABASE_URL}/storage/v1/object/public/backgrounds/transback.png`;

const CONGRESS_PHOTO_BASE = 'https://unitedstates.github.io/images/congress/225x275';
const BIOGUIDE_RE = /^[A-Z]\d{6}$/;
const CONGRESS_URL_RE = /\/225x275\/([A-Z]\d{6})\.jpg/i;

/** SEC Form 4 ALL CAPS: "MUSK ELON" → "Elon Musk". לא הופך שמות שכבר בפורמט First Last. */
export function formatInsiderDisplayName(raw: string): string {
  const trimmed = raw.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return trimmed;
  const secLike = parts.every((p) => p === p.toUpperCase() && /[A-Z]/.test(p));
  if (!secLike) return trimmed;
  const last = parts[0];
  const given = parts.slice(1);
  const titleCase = (s: string) =>
    s.length <= 1
      ? s.toUpperCase()
      : `${s.charAt(0).toUpperCase()}${s.slice(1).toLowerCase()}`;
  return `${given.map(titleCase).join(' ')} ${titleCase(last)}`.trim();
}

export function congressPhotoUrl(bioguideId: string | null | undefined): string | null {
  const id = bioguideId?.trim().toUpperCase();
  if (!id || !BIOGUIDE_RE.test(id)) return null;
  return `${CONGRESS_PHOTO_BASE}/${id}.jpg`;
}

export function extractBioguideFromCongressUrl(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  const m = CONGRESS_URL_RE.exec(raw);
  return m?.[1]?.toUpperCase() ?? null;
}

/** URL של תמונת אדם — לא placeholder / לוגו חברה / אייקון UW */
export function looksLikePersonPhoto(url: string): boolean {
  const u = url.toLowerCase();
  if (u.includes('transback.png')) return false;
  if (u.includes('brandfetch') || u.includes('/logo') || u.includes('clearbit')) {
    return false;
  }
  if (u.includes('uwassets') && (u.includes('/tickers') || u.includes('/logos'))) {
    return false;
  }
  return true;
}

/**
 * מועמדי תמונת פרופיל — אותו סדר לאווטאר גיבור ולמרכז עוגת האחזקות.
 * דיוקנאות ידועים קודם (כמו בגילוי), אחר כך URL אמיתי מ-API/ניווט (לא לוגו).
 */
export function portraitPhotoCandidates(opts: {
  imageUrl?: string | null;
  imageHint?: string | null;
  kind?: 'politician' | 'insider' | 'fund_manager';
  personId?: string;
  bioguideId?: string | null;
  name?: string | null;
}): string[] {
  const out: string[] = [];
  const add = (url?: string | null) => {
    const t = url?.trim();
    if (t && !out.includes(t)) out.push(t);
  };
  const addPersonPhoto = (url?: string | null) => {
    const t = url?.trim();
    if (t && looksLikePersonPhoto(t)) add(t);
  };

  add(knownPortraitForInvestor({ personId: opts.personId, name: opts.name }));

  if (opts.kind === 'politician') {
    add(congressPhotoUrl(opts.bioguideId));
    add(congressPhotoUrl(opts.personId));
    add(congressPhotoUrl(extractBioguideFromCongressUrl(opts.imageUrl)));
    add(congressPhotoUrl(extractBioguideFromCongressUrl(opts.imageHint)));
  }

  addPersonPhoto(opts.imageUrl);
  addPersonPhoto(opts.imageHint);

  return out;
}

export function resolveInvestorPortraitUri(opts: {
  imageUrl?: string | null;
  kind?: 'politician' | 'insider' | 'fund_manager';
  personId?: string;
  bioguideId?: string | null;
  name?: string | null;
}): string {
  const [first] = portraitPhotoCandidates(opts);
  if (first) return first;
  return INVESTOR_PORTRAIT_PLACEHOLDER_URI;
}
