import { SUPABASE_URL } from '../../../config/publicEnv';
import { knownPortraitForInvestor } from './knownInvestorPortraits';

/** תמונת ברירת מחדל — שור/דוב (transback) מה-storage של האפליקציה. */
export const INVESTOR_PORTRAIT_PLACEHOLDER_URI = `${SUPABASE_URL}/storage/v1/object/public/backgrounds/transback.png`;

const CONGRESS_PHOTO_BASE = 'https://unitedstates.github.io/images/congress/225x275';
const BIOGUIDE_RE = /^[A-Z]\d{6}$/;
const CONGRESS_URL_RE = /\/225x275\/([A-Z]\d{6})\.jpg/i;

/** SEC Form 4: "MUSK ELON" → "Elon Musk" */
export function formatInsiderDisplayName(raw: string): string {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return raw.trim();
  const last = parts[0];
  const rest = parts.slice(1).join(' ');
  return `${rest} ${last}`.trim();
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

  add(opts.imageUrl);
  add(opts.imageHint);
  add(knownPortraitForInvestor({ personId: opts.personId, name: opts.name }));

  if (opts.kind === 'politician') {
    add(congressPhotoUrl(opts.bioguideId));
    add(congressPhotoUrl(opts.personId));
    add(congressPhotoUrl(extractBioguideFromCongressUrl(opts.imageUrl)));
    add(congressPhotoUrl(extractBioguideFromCongressUrl(opts.imageHint)));
  }

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
