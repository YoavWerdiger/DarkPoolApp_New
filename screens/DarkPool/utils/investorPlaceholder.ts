import { SUPABASE_URL } from '../../../config/publicEnv';
import { knownPortraitForInvestor } from './knownInvestorPortraits';

/** תמונת ברירת מחדל — שור/דוב (transback) מה-storage של האפליקציה. */
export const INVESTOR_PORTRAIT_PLACEHOLDER_URI = `${SUPABASE_URL}/storage/v1/object/public/backgrounds/transback.png`;

const CONGRESS_PHOTO_HOST = 'https://unitedstates.github.io/images/congress';
const BIOGUIDE_RE = /^[A-Z]\d{6}$/;
const CONGRESS_URL_RE = /\/(?:225x275|450x550)\/([A-Z]\d{6})\.jpg/i;
export type CongressPhotoSize = '225x275' | '450x550';
/** Wikimedia commons ישיר: /wikipedia/commons/{a}/{ab}/File.jpg */
const WIKI_COMMONS_PATH_RE =
  /^(https?:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)$/i;
/** Thumb קיים: /wikipedia/commons/thumb/{a}/{ab}/File.jpg/{N}px-File.jpg */
const WIKI_THUMB_PATH_RE =
  /^(https?:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/thumb\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)\/(\d+)px-\4(?:\?.*)?$/i;

/**
 * Wikimedia מאשר רק רוחבי thumb ספציפיים — 256/320/480 וכו׳ מחזירים 400.
 * חייבים snap לרשימה הזו (נבדק 2026-08 מול upload.wikimedia.org).
 */
const WIKI_ALLOWED_THUMB_WIDTHS = [120, 250, 500, 960, 1280] as const;

export function snapWikiThumbWidth(px: number): number {
  const edge = Math.max(64, Math.min(1280, Math.round(px)));
  for (const w of WIKI_ALLOWED_THUMB_WIDTHS) {
    if (w >= edge) return w;
  }
  return WIKI_ALLOWED_THUMB_WIDTHS[WIKI_ALLOWED_THUMB_WIDTHS.length - 1];
}

/**
 * מקטין תמונות Wikimedia מלאות ל-thumb — מונע הורדת קבצים ענקיים לרשימות.
 * גדלים אחרים (congress 225x275 וכו׳) נשארים כמו שהם.
 */
export function portraitDisplayUrl(
  url: string | null | undefined,
  maxEdgePx = 320
): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  const edge = snapWikiThumbWidth(maxEdgePx);

  const thumb = WIKI_THUMB_PATH_RE.exec(raw);
  if (thumb) {
    const [, base, a, ab, file, current] = thumb;
    if (Number(current) === edge) return raw.split('?')[0];
    return `${base}/thumb/${a}/${ab}/${file}/${edge}px-${file}`;
  }

  const m = WIKI_COMMONS_PATH_RE.exec(raw);
  if (!m) return raw;
  const [, base, a, ab, file] = m;
  return `${base}/thumb/${a}/${ab}/${file}/${edge}px-${file}`;
}

const ENTITY_NAME_RE =
  /\b(INC|LLC|LP|L\.P\.|LTD|CORP|CO\.|TRUST|FUND|MANAGEMENT|PARTNERS|CAPITAL|VENTURES|HOLDINGS)\b/i;

function titleCaseNameToken(s: string): string {
  const core = s.replace(/\.$/, '');
  if (core.length <= 1) return core.toUpperCase();
  return `${core.charAt(0).toUpperCase()}${core.slice(1).toLowerCase()}`;
}

function isNameInitial(s: string): boolean {
  return /^[A-Za-z]\.?$/.test(s);
}

function formatInitial(s: string): string {
  return `${s.replace(/\.$/, '').toUpperCase()}.`;
}

/**
 * SEC / UW: "MUSK ELON", "Bucella Michael C." → "Elon Musk", "Michael C. Bucella".
 * לא הופך First Last שכבר נכון, ולא שמות חברה.
 */
export function formatInsiderDisplayName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || ENTITY_NAME_RE.test(trimmed)) return trimmed;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return trimmed;

  const allCaps = parts.every(
    (p) => p.replace(/\./g, '') === p.replace(/\./g, '').toUpperCase() && /[A-Za-z]/.test(p)
  );
  const caseToken = (s: string) => (allCaps ? titleCaseNameToken(s) : s.replace(/\.$/, ''));

  // First M. Last — כבר בסדר הקריאה הנכון
  if (parts.length >= 3 && isNameInitial(parts[1])) {
    const given = caseToken(parts[0]);
    const last = parts.slice(2).map(caseToken).join(' ');
    return `${given} ${formatInitial(parts[1])} ${last}`.trim();
  }

  // Last First M. — פורמט Form 4
  if (parts.length >= 3 && isNameInitial(parts[parts.length - 1])) {
    const last = caseToken(parts[0]);
    const given = parts.slice(1, -1).map(caseToken).join(' ');
    return `${given} ${formatInitial(parts[parts.length - 1])} ${last}`.trim();
  }

  if (!allCaps) return trimmed;
  const last = parts[0];
  const given = parts.slice(1);
  return `${given.map(titleCaseNameToken).join(' ')} ${titleCaseNameToken(last)}`.trim();
}

export function congressPhotoUrl(
  bioguideId: string | null | undefined,
  size: CongressPhotoSize = '225x275'
): string | null {
  const id = bioguideId?.trim().toUpperCase();
  if (!id || !BIOGUIDE_RE.test(id)) return null;
  return `${CONGRESS_PHOTO_HOST}/${size}/${id}.jpg`;
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
  /** דיוקן full-bleed — 450x550 לפני 225x275 */
  photoSize?: CongressPhotoSize;
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

  if (opts.kind === 'politician' && opts.photoSize === '450x550') {
    add(congressPhotoUrl(opts.bioguideId, '450x550'));
    add(congressPhotoUrl(opts.personId, '450x550'));
  }

  add(knownPortraitForInvestor({ personId: opts.personId, name: opts.name }));

  if (opts.kind === 'politician') {
    const size = opts.photoSize ?? '225x275';
    add(congressPhotoUrl(opts.bioguideId, size));
    add(congressPhotoUrl(opts.personId, size));
    add(congressPhotoUrl(extractBioguideFromCongressUrl(opts.imageUrl), size));
    add(congressPhotoUrl(extractBioguideFromCongressUrl(opts.imageHint), size));
    if (size !== '225x275') {
      add(congressPhotoUrl(opts.bioguideId));
      add(congressPhotoUrl(opts.personId));
    }
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
  /** רוחב תצוגה — לוויקימדיה יומר ל-thumb */
  displaySize?: number;
}): string {
  const [first] = portraitPhotoCandidates(opts);
  if (first) {
    return portraitDisplayUrl(first, opts.displaySize ?? 320) ?? first;
  }
  return INVESTOR_PORTRAIT_PLACEHOLDER_URI;
}
