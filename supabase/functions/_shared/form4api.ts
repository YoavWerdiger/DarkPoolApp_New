/**
 * Form4API client — https://form4api.com/docs
 * Auth: X-Api-Key header
 */

const BASE = 'https://api.form4api.com';

export interface Form4Transaction {
  ticker?: string;
  companyName?: string;
  insiderName?: string;
  insiderCik?: string;
  insiderTitle?: string;
  isDirector?: boolean;
  isOfficer?: boolean;
  is10PctOwner?: boolean;
  accessionNumber?: string;
  transactionCode?: string;
  isOpenMarket?: boolean;
  is10b5Plan?: boolean;
  sharesAmount?: number;
  pricePerShare?: number | null;
  totalValue?: number | null;
  sharesOwnedAfter?: number | null;
  transactionDate?: string;
  filedAt?: string;
  periodOfReport?: string;
  return1d?: number | null;
  return1w?: number | null;
  return1m?: number | null;
  return3m?: number | null;
  return6m?: number | null;
}

export interface Form4InsiderSummary {
  cik: string;
  name: string;
  isDirector?: boolean;
  isOfficer?: boolean;
  isTenPercentOwner?: boolean;
  officerTitle?: string | null;
  totalFilings?: number;
}

export interface Form4Company {
  cik?: string;
  name?: string;
  ticker?: string;
  exchange?: string;
  totalFilings?: number;
  activeInsiders?: number;
  sicDescription?: string | null;
  stateOfIncorporation?: string | null;
  website?: string | null;
}

export interface Form4CompanyInsider {
  cik?: string;
  name?: string;
  officerTitle?: string | null;
  lastTransactionDate?: string | null;
}

export interface Form4Signal {
  ticker?: string;
  companyName?: string;
  signalDate?: string;
  buySellRatio?: number;
  isClusterBuy?: boolean;
  isClusterSell?: boolean;
  insiderCount?: number;
}

export interface Form4SentimentMonth {
  period: string;
  score: number;
  buyValue: number;
  sellValue: number;
  buyCount: number;
  sellCount: number;
}

export interface Form4RecentFiling {
  accessionNumber?: string;
  companyTicker?: string;
  companyName?: string;
  periodOfReport?: string;
  filedAt?: string;
  transactionCount?: number;
}

export interface NormalizedForm4Trade {
  external_id: string;
  ticker: string;
  company_name: string | null;
  insider_cik: string | null;
  insider_name: string | null;
  insider_role: string | null;
  transaction_type: 'P' | 'S' | 'A' | 'M' | 'G' | 'F' | 'O' | 'D';
  shares: number;
  price: number;
  value: number;
  filed_at: string;
  transaction_date: string;
  source: 'form4api';
  sector: string | null;
  is_10b5_plan: boolean | null;
  shares_owned_after: number | null;
  return_1d: number | null;
  return_1w: number | null;
  return_1m: number | null;
  return_3m: number | null;
  return_6m: number | null;
}

export function resolveForm4ApiKey(): string | null {
  return Deno.env.get('FORM4_API_KEY')?.trim() || null;
}

class Form4ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
  }

  get isPlanRequired() {
    return this.status === 402 || this.code === 'PLAN_REQUIRED';
  }
}

async function delay(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function form4Fetch(
  apiKey: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<Response> {
  const url = new URL(`${BASE}${path.startsWith('/') ? path : `/${path}`}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url.toString(), {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
    });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After') || '2');
      await delay(Math.min(30, Math.max(1, retryAfter)) * 1000);
      continue;
    }
    return res;
  }
  throw new Error(`form4api rate limit: ${path}`);
}

async function form4Json<T>(
  apiKey: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const res = await form4Fetch(apiKey, path, params);
  if (!res.ok) {
    const body = await res.text();
    let code: string | undefined;
    try {
      const parsed = JSON.parse(body) as { error?: { code?: string; message?: string } };
      code = parsed.error?.code;
      throw new Form4ApiError(
        parsed.error?.message || `form4api ${res.status}`,
        res.status,
        code
      );
    } catch (e) {
      if (e instanceof Form4ApiError) throw e;
      throw new Form4ApiError(`form4api ${path} ${res.status}: ${body.slice(0, 200)}`, res.status);
    }
  }
  return (await res.json()) as T;
}

function unwrapArray<T>(json: T[] | { data?: T[] }): T[] {
  if (Array.isArray(json)) return json;
  return json.data ?? [];
}

export async function fetchForm4Transactions(
  apiKey: string,
  opts: {
    ticker?: string;
    insiderCik?: string;
    code?: 'P' | 'S';
    from?: string;
    to?: string;
    exclude10b5?: boolean;
    maxPages?: number;
    perPage?: number;
  } = {}
): Promise<Form4Transaction[]> {
  const maxPages = Math.min(20, Math.max(1, opts.maxPages ?? 10));
  const perPage = Math.min(100, Math.max(10, opts.perPage ?? 100));
  const out: Form4Transaction[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const batch = unwrapArray(
      await form4Json<Form4Transaction[] | { data?: Form4Transaction[] }>(
        apiKey,
        '/v1/transactions',
        {
          ticker: opts.ticker,
          insider_cik: opts.insiderCik,
          code: opts.code,
          from: opts.from,
          to: opts.to,
          exclude_10b5: opts.exclude10b5 === true ? true : undefined,
          per_page: perPage,
          page,
        }
      )
    );
    if (!batch.length) break;
    out.push(...batch);
    if (batch.length < perPage) break;
    await delay(80);
  }
  return out;
}

export async function searchForm4Insiders(
  apiKey: string,
  name: string,
  perPage = 20
): Promise<Form4InsiderSummary[]> {
  const q = name.trim();
  if (q.length < 2) return [];
  return unwrapArray(
    await form4Json<Form4InsiderSummary[] | { data?: Form4InsiderSummary[] }>(
      apiKey,
      '/v1/insiders',
      { name: q, per_page: perPage }
    )
  );
}

export async function fetchForm4InsiderProfile(
  apiKey: string,
  cik: string
): Promise<Form4InsiderSummary | null> {
  try {
    return await form4Json<Form4InsiderSummary>(apiKey, `/v1/insiders/${encodeURIComponent(cik)}`);
  } catch (e) {
    if (e instanceof Form4ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function fetchForm4InsiderTransactions(
  apiKey: string,
  cik: string,
  opts: { from?: string; maxPages?: number } = {}
): Promise<Form4Transaction[]> {
  const maxPages = Math.min(30, Math.max(1, opts.maxPages ?? 15));
  const out: Form4Transaction[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = unwrapArray(
      await form4Json<Form4Transaction[] | { data?: Form4Transaction[] }>(
        apiKey,
        `/v1/insiders/${encodeURIComponent(cik)}/transactions`,
        { from: opts.from, per_page: 100, page }
      )
    );
    if (!batch.length) break;
    out.push(...batch);
    if (batch.length < 100) break;
    await delay(80);
  }
  return out;
}

export async function fetchForm4Company(
  apiKey: string,
  ticker: string
): Promise<Form4Company | null> {
  try {
    return await form4Json<Form4Company>(
      apiKey,
      `/v1/companies/${encodeURIComponent(ticker.toUpperCase())}`
    );
  } catch (e) {
    if (e instanceof Form4ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function fetchForm4CompanyInsiders(
  apiKey: string,
  ticker: string
): Promise<Form4CompanyInsider[]> {
  try {
    return unwrapArray(
      await form4Json<Form4CompanyInsider[] | { data?: Form4CompanyInsider[] }>(
        apiKey,
        `/v1/companies/${encodeURIComponent(ticker.toUpperCase())}/insiders`
      )
    );
  } catch (e) {
    if (e instanceof Form4ApiError && e.status === 404) return [];
    throw e;
  }
}

export async function fetchForm4RecentFilings(
  apiKey: string,
  ticker?: string,
  perPage = 20
): Promise<Form4RecentFiling[]> {
  return unwrapArray(
    await form4Json<Form4RecentFiling[] | { data?: Form4RecentFiling[] }>(
      apiKey,
      '/v1/filings/recent',
      { ticker, per_page: perPage }
    )
  );
}

export async function fetchForm4Signals(
  apiKey: string,
  opts: { ticker?: string; clusterBuy?: boolean; maxPages?: number } = {}
): Promise<Form4Signal[]> {
  try {
    const maxPages = Math.min(5, opts.maxPages ?? 3);
    const out: Form4Signal[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const batch = unwrapArray(
        await form4Json<Form4Signal[] | { data?: Form4Signal[] }>(apiKey, '/v1/signals', {
          ticker: opts.ticker,
          cluster_buy: opts.clusterBuy ? true : undefined,
          per_page: 100,
          page,
        })
      );
      if (!batch.length) break;
      out.push(...batch);
      if (batch.length < 100) break;
    }
    return out;
  } catch (e) {
    if (e instanceof Form4ApiError && e.isPlanRequired) return [];
    throw e;
  }
}

export async function fetchForm4Sentiment(
  apiKey: string,
  ticker: string,
  months = 12
): Promise<{ ticker: string; companyName?: string; monthly: Form4SentimentMonth[] } | null> {
  try {
    return await form4Json(apiKey, `/v1/signals/sentiment/${encodeURIComponent(ticker)}`, {
      months,
    });
  } catch (e) {
    if (e instanceof Form4ApiError && e.isPlanRequired) return null;
    throw e;
  }
}

export function mapForm4Transaction(r: Form4Transaction): NormalizedForm4Trade | null {
  if (!r.ticker || !r.transactionDate) return null;
  const code = (r.transactionCode || 'P').toUpperCase();
  if (code !== 'P' && code !== 'S') return null;
  if (r.isOpenMarket === false) return null;

  const shares = Number(r.sharesAmount) || 0;
  const price = r.pricePerShare != null ? Number(r.pricePerShare) : 0;
  const value =
    r.totalValue != null && Number.isFinite(Number(r.totalValue))
      ? Number(r.totalValue)
      : shares * price;
  if (shares <= 0) return null;

  const txDate = r.transactionDate.slice(0, 10);
  const filedAt = r.filedAt || r.transactionDate;
  const insiderCik = r.insiderCik?.trim() || null;
  const accession = r.accessionNumber?.trim();

  const external_id = accession
    ? `f4:${accession}:${insiderCik ?? 'na'}:${code}:${txDate}:${shares}:${price}`
    : `f4:${r.ticker}:${insiderCik ?? 'na'}:${code}:${txDate}:${shares}:${price}`;

  const roleParts: string[] = [];
  if (r.insiderTitle?.trim()) roleParts.push(r.insiderTitle.trim());
  else {
    if (r.isOfficer) roleParts.push('Officer');
    if (r.isDirector) roleParts.push('Director');
    if (r.is10PctOwner) roleParts.push('10% Owner');
  }

  return {
    external_id,
    ticker: r.ticker.toUpperCase(),
    company_name: r.companyName?.trim() || null,
    insider_cik: insiderCik,
    insider_name: r.insiderName ?? null,
    insider_role: roleParts.join(' · ') || null,
    transaction_type: code as 'P' | 'S',
    shares,
    price,
    value,
    filed_at: filedAt,
    transaction_date: txDate,
    source: 'form4api',
    sector: null,
    is_10b5_plan: r.is10b5Plan ?? null,
    shares_owned_after: r.sharesOwnedAfter != null ? Number(r.sharesOwnedAfter) : null,
    return_1d: r.return1d ?? null,
    return_1w: r.return1w ?? null,
    return_1m: r.return1m ?? null,
    return_3m: r.return3m ?? null,
    return_6m: r.return6m ?? null,
  };
}

export async function fetchForm4InsiderTradesForSync(
  apiKey: string,
  sinceIso: string,
  opts: { exclude10b5?: boolean; maxPages?: number } = {}
): Promise<NormalizedForm4Trade[]> {
  const from = sinceIso.slice(0, 10);
  const exclude10b5 = opts.exclude10b5 !== false;
  const maxPages = opts.maxPages ?? Number(Deno.env.get('FORM4_MAX_PAGES') || '10');

  const [purchases, sales] = await Promise.all([
    fetchForm4Transactions(apiKey, { code: 'P', from, exclude10b5, maxPages }),
    fetchForm4Transactions(apiKey, { code: 'S', from, exclude10b5, maxPages }),
  ]);

  const seen = new Set<string>();
  const out: NormalizedForm4Trade[] = [];
  for (const r of [...purchases, ...sales]) {
    const row = mapForm4Transaction(r);
    if (!row || seen.has(row.external_id)) continue;
    seen.add(row.external_id);
    out.push(row);
  }
  return out;
}

/** מצא CIK לפי שם + טיקר (אופציונלי) */
export async function resolveForm4InsiderCik(
  apiKey: string,
  nameHint: string,
  ticker?: string,
  existingCik?: string | null
): Promise<string | null> {
  if (existingCik?.trim()) return existingCik.trim().replace(/\D/g, '').padStart(10, '0');

  const q = nameHint.trim();
  if (q.length < 2) return null;

  const hits = await searchForm4Insiders(apiKey, q, 15);
  if (!hits.length) return null;

  if (ticker) {
    const txs = await fetchForm4Transactions(apiKey, {
      ticker: ticker.toUpperCase(),
      from: yearsAgoIso(3),
      maxPages: 2,
    });
    const namesOnTicker = new Set(
      txs.map((t) => normalizePersonKey(t.insiderName || '')).filter(Boolean)
    );
    const target = normalizePersonKey(q);
    for (const h of hits) {
      const hk = normalizePersonKey(h.name);
      if (!hk) continue;
      if (namesOnTicker.has(hk) || hk.includes(target) || target.includes(hk)) {
        return h.cik;
      }
    }
  }

  const target = normalizePersonKey(q);
  const exact = hits.find((h) => normalizePersonKey(h.name) === target);
  return (exact ?? hits[0]).cik;
}

export function yearsAgoIso(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

export function normalizePersonKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatForm4InsiderName(raw: string): string {
  const p = raw.trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return raw;
  const last = p[0];
  const rest = p.slice(1).join(' ');
  if (/^[A-Z]{2,}$/.test(last) && rest) return `${rest} ${last}`.trim();
  return raw.trim();
}

export async function loadForm4InsiderHistory(
  apiKey: string,
  opts: { cik?: string | null; nameHint?: string; ticker?: string; years?: number }
): Promise<{ profile: Form4InsiderSummary | null; trades: Form4Transaction[]; company: Form4Company | null }> {
  const years = opts.years ?? 5;
  const from = yearsAgoIso(years);
  const cik =
    opts.cik ||
    (opts.nameHint ? await resolveForm4InsiderCik(apiKey, opts.nameHint, opts.ticker) : null);

  const [profile, trades, company] = await Promise.all([
    cik ? fetchForm4InsiderProfile(apiKey, cik) : Promise.resolve(null),
    cik
      ? fetchForm4InsiderTransactions(apiKey, cik, { from, maxPages: 20 })
      : opts.ticker
        ? fetchForm4Transactions(apiKey, {
            ticker: opts.ticker,
            from,
            exclude10b5: false,
            maxPages: 15,
          })
        : Promise.resolve([]),
    opts.ticker ? fetchForm4Company(apiKey, opts.ticker) : Promise.resolve(null),
  ]);

  return { profile, trades, company };
}
