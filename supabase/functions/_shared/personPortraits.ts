/**
 * רזולוציית תמונות פרופיל — congress / Wikipedia / known (SEC mode, בלי UW).
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';

export type PortraitKind = 'politician' | 'insider' | 'fund_manager';
export type PortraitSource = 'congress' | 'wikipedia' | 'known' | 'manual' | 'none';

export interface PortraitRow {
  person_id: string;
  kind: PortraitKind;
  display_name: string | null;
  ticker: string | null;
  image_url: string | null;
  source: PortraitSource | null;
  lookup_name: string | null;
  fail_count: number;
  last_error: string | null;
  resolved_at: string | null;
}

export interface ResolvePortraitInput {
  personId: string;
  kind: PortraitKind;
  displayName?: string | null;
  ticker?: string | null;
}

export interface ResolvePortraitResult {
  image_url: string | null;
  source: PortraitSource;
  lookup_name: string | null;
  last_error?: string | null;
}

const CONGRESS_PHOTO = 'https://unitedstates.github.io/images/congress/225x275';
const BIOGUIDE_RE = /^[A-Z]\d{6}$/;
const WIKI = 'https://upload.wikimedia.org/wikipedia/commons';

const KNOWN_BY_ID: Record<string, string> = {
  G000583: `${CONGRESS_PHOTO}/G000583.jpg`,
  P000197: `${CONGRESS_PHOTO}/P000197.jpg`,
  '888dc73f-f1eb-485a-a241-80657aaaaff9': `${WIKI}/5/56/Donald_Trump_official_portrait.jpg`,
  '1067983': `${WIKI}/5/51/Warren_Buffett_KU_Visit.jpg`,
  '1697748': `${WIKI}/4/44/Cathie_Wood_ARK_Invest_Photo.jpg`,
  '1336528': `${WIKI}/d/d8/Bill_Ackman_%2826410186110%29_%28cropped%29.jpg`,
  'TSLA:Musk': `${WIKI}/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg`,
  'AAPL:Cook': `${WIKI}/f/f7/Tim_Cook_March_2026_%28cropped_2%29.jpg`,
  'MSFT:Nadella': `${WIKI}/4/4a/Satya_Nadella_%28cropped%29.jpg`,
  'NVDA:Huang': `${WIKI}/c/c4/Jensen_Huang_%28cropped%29.jpg`,
  'META:Zuckerberg': `${WIKI}/1/18/Mark_Zuckerberg_F8_2019_Keynote_%2832830578717%29_%28cropped%29.jpg`,
  'ORCL:Ellison': `${WIKI}/0/0e/Larry_Ellison_picture_%28cropped%29.png`,
};

const KNOWN_BY_NAME: Record<string, string> = {
  'elon musk': KNOWN_BY_ID['TSLA:Musk'],
  'tim cook': KNOWN_BY_ID['AAPL:Cook'],
  'cook tim': KNOWN_BY_ID['AAPL:Cook'],
  'satya nadella': KNOWN_BY_ID['MSFT:Nadella'],
  'jensen huang': KNOWN_BY_ID['NVDA:Huang'],
  'huang jensen': KNOWN_BY_ID['NVDA:Huang'],
  'mark zuckerberg': KNOWN_BY_ID['META:Zuckerberg'],
  'larry ellison': KNOWN_BY_ID['ORCL:Ellison'],
  'warren buffett': KNOWN_BY_ID['1067983'],
  'cathie wood': KNOWN_BY_ID['1697748'],
  'bill ackman': KNOWN_BY_ID['1336528'],
  'nancy pelosi': KNOWN_BY_ID.P000197,
  'donald trump': KNOWN_BY_ID['888dc73f-f1eb-485a-a241-80657aaaaff9'],
  'donald j trump': KNOWN_BY_ID['888dc73f-f1eb-485a-a241-80657aaaaff9'],
};

const WIKI_DELAY_MS = 320;

function wikiUserAgent(): string {
  return (
    Deno.env.get('WIKIMEDIA_USER_AGENT')?.trim() ||
    'DarkPoolApp/1.0 (portrait-sync; contact@darkpool.app)'
  );
}

export function congressPhotoUrl(bioguideId: string | null | undefined): string | null {
  const id = bioguideId?.trim().toUpperCase();
  if (!id || !BIOGUIDE_RE.test(id)) return null;
  return `${CONGRESS_PHOTO}/${id}.jpg`;
}

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

export function insiderPersonId(ticker: string, insiderName: string): string {
  return `${ticker.toUpperCase()}:${insiderName.trim()}`;
}

export function isEntityInsiderName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return /\b(INC|LLC|LP|L\.P\.|LTD|CORP|CO\.|TRUST|FUND|MANAGEMENT|PARTNERS|CAPITAL|VENTURES|HOLDINGS)\b/i.test(
    name
  );
}

export function knownPortraitUrl(
  personId?: string | null,
  displayName?: string | null
): string | null {
  const id = personId?.trim();
  if (id && KNOWN_BY_ID[id]) return KNOWN_BY_ID[id];

  const nameKey = displayName?.trim().toLowerCase();
  if (nameKey && KNOWN_BY_NAME[nameKey]) return KNOWN_BY_NAME[nameKey];

  if (id && nameKey) {
    const idUpper = id.toUpperCase();
    if (idUpper.includes('MUSK') || nameKey.includes('musk')) {
      return KNOWN_BY_NAME['elon musk'];
    }
    if (idUpper.includes('COOK') || nameKey.includes('cook')) {
      return KNOWN_BY_NAME['tim cook'];
    }
    if (
      nameKey.includes('jensen huang') ||
      nameKey.includes('huang jensen') ||
      (idUpper.includes('NVDA') && idUpper.includes('HUANG'))
    ) {
      return KNOWN_BY_NAME['jensen huang'];
    }
    if (nameKey.includes('nadella') || (idUpper.includes('MSFT') && idUpper.includes('NADELLA'))) {
      return KNOWN_BY_NAME['satya nadella'];
    }
    if (nameKey.includes('ellison') || (idUpper.includes('ORCL') && idUpper.includes('ELLISON'))) {
      return KNOWN_BY_NAME['larry ellison'];
    }
    if (nameKey.includes('ackman') || id === '1336528') {
      return KNOWN_BY_NAME['bill ackman'];
    }
  }

  return null;
}

function titleCaseWords(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function wikiTitleFromName(name: string): string {
  return titleCaseWords(name).replace(/ /g, '_');
}

async function fetchWikipediaSummary(title: string): Promise<{ image: string | null; error?: string }> {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'));
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': wikiUserAgent(),
      },
    });
    if (res.status === 404) return { image: null };
    if (!res.ok) return { image: null, error: `wikipedia ${res.status}` };
    const data = await res.json();
    const image =
      (typeof data.originalimage?.source === 'string' ? data.originalimage.source : null) ||
      (typeof data.thumbnail?.source === 'string' ? data.thumbnail.source : null);
    return { image };
  } catch (e) {
    return { image: null, error: (e as Error).message };
  }
}

async function searchWikipediaTitle(name: string): Promise<string | null> {
  const q = encodeURIComponent(name.trim());
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&format=json&origin=*&srlimit=3`,
      { headers: { 'User-Agent': wikiUserAgent(), Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const hits = data.query?.search as Array<{ title?: string }> | undefined;
    if (!hits?.length) return null;
    const normalized = name.trim().toLowerCase();
    const exact = hits.find((h) => h.title?.trim().toLowerCase() === normalized);
    return (exact ?? hits[0])?.title ?? null;
  } catch {
    return null;
  }
}

export async function fetchWikipediaPortrait(displayName: string): Promise<ResolvePortraitResult> {
  const lookup = displayName.trim();
  if (!lookup || lookup.length < 2) {
    return { image_url: null, source: 'none', lookup_name: lookup, last_error: 'empty name' };
  }

  const directTitle = wikiTitleFromName(lookup);
  let result = await fetchWikipediaSummary(directTitle);
  if (result.image) {
    return { image_url: result.image, source: 'wikipedia', lookup_name: lookup };
  }

  await delay(WIKI_DELAY_MS);

  const searched = await searchWikipediaTitle(lookup);
  if (searched && searched.replace(/_/g, ' ').toLowerCase() !== lookup.toLowerCase()) {
    result = await fetchWikipediaSummary(searched.replace(/ /g, '_'));
    if (result.image) {
      return { image_url: result.image, source: 'wikipedia', lookup_name: lookup };
    }
  }

  return {
    image_url: null,
    source: 'none',
    lookup_name: lookup,
    last_error: result.error ?? 'not found',
  };
}

export async function resolvePortrait(input: ResolvePortraitInput): Promise<ResolvePortraitResult> {
  const personId = input.personId.trim();
  const displayName = input.displayName?.trim() || null;
  const ticker = input.ticker?.trim().toUpperCase() || null;

  const known = knownPortraitUrl(personId, displayName);
  if (known) {
    return { image_url: known, source: 'known', lookup_name: displayName };
  }

  if (input.kind === 'politician') {
    const congress = congressPhotoUrl(personId);
    if (congress) {
      return { image_url: congress, source: 'congress', lookup_name: displayName };
    }
    if (displayName) {
      return await fetchWikipediaPortrait(displayName);
    }
    return { image_url: null, source: 'none', lookup_name: displayName, last_error: 'no name' };
  }

  if (input.kind === 'insider') {
    if (displayName && isEntityInsiderName(displayName)) {
      return {
        image_url: null,
        source: 'none',
        lookup_name: displayName,
        last_error: 'entity name',
      };
    }
    const lookup = displayName ? formatInsiderDisplayName(displayName) : null;
    if (lookup) {
      const wiki = await fetchWikipediaPortrait(lookup);
      if (wiki.image_url) return wiki;
      return { ...wiki, lookup_name: lookup };
    }
    return { image_url: null, source: 'none', lookup_name: displayName, last_error: 'no name' };
  }

  return { image_url: null, source: 'none', lookup_name: displayName, last_error: 'unsupported kind' };
}

export async function loadPortraitFromDb(
  supabase: SupabaseClient,
  personId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('dark_pool_person_portraits')
    .select('image_url')
    .eq('person_id', personId)
    .maybeSingle();
  const url = data?.image_url;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

export async function upsertPortrait(
  supabase: SupabaseClient,
  row: {
    person_id: string;
    kind: PortraitKind;
    display_name?: string | null;
    ticker?: string | null;
    image_url: string | null;
    source: PortraitSource;
    lookup_name?: string | null;
    last_error?: string | null;
    fail_count?: number;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const failInc = row.image_url ? 0 : (row.fail_count ?? 0) + 1;

  await supabase.from('dark_pool_person_portraits').upsert(
    {
      person_id: row.person_id,
      kind: row.kind,
      display_name: row.display_name ?? null,
      ticker: row.ticker ?? null,
      image_url: row.image_url,
      source: row.source,
      lookup_name: row.lookup_name ?? null,
      last_error: row.image_url ? null : row.last_error ?? null,
      fail_count: row.image_url ? 0 : failInc,
      resolved_at: now,
    },
    { onConflict: 'person_id' }
  );
}

export async function propagatePortraitsToTrades(supabase: SupabaseClient): Promise<{
  insiders_updated: number;
  politicians_updated: number;
}> {
  let insiders_updated = 0;
  let politicians_updated = 0;

  const { data: insiderPortraits } = await supabase
    .from('dark_pool_person_portraits')
    .select('person_id, image_url, ticker, display_name')
    .eq('kind', 'insider')
    .not('image_url', 'is', null)
    .limit(500);

  for (const p of insiderPortraits ?? []) {
    const personId = String(p.person_id);
    const colon = personId.indexOf(':');
    if (colon <= 0) continue;
    const ticker = personId.slice(0, colon);
    const insiderName = personId.slice(colon + 1);
    const image = String(p.image_url);
    const { data, error } = await supabase
      .from('dark_pool_insider_buys')
      .update({ insider_logo_url: image })
      .eq('ticker', ticker)
      .eq('insider_name', insiderName)
      .is('insider_logo_url', null)
      .select('id');
    insiders_updated += data?.length ?? 0;
  }

  const { data: polPortraits } = await supabase
    .from('dark_pool_person_portraits')
    .select('person_id, image_url')
    .eq('kind', 'politician')
    .not('image_url', 'is', null)
    .limit(500);

  for (const p of polPortraits ?? []) {
    const { data } = await supabase
      .from('dark_pool_congress_trades')
      .update({ politician_image_url: String(p.image_url) })
      .eq('politician_id', String(p.person_id))
      .is('politician_image_url', null)
      .select('id');
    politicians_updated += data?.length ?? 0;
  }

  return { insiders_updated, politicians_updated };
}

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function shouldRetryPortrait(row: PortraitRow | null, force: boolean): boolean {
  if (force) return true;
  if (!row) return true;
  if (row.image_url) return false;
  if (row.fail_count >= 5) return false;
  if (!row.resolved_at) return true;
  const ageMs = Date.now() - new Date(row.resolved_at).getTime();
  const retryDays = row.fail_count >= 2 ? 30 : 7;
  return ageMs > retryDays * 24 * 60 * 60 * 1000;
}
