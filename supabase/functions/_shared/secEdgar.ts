/**
 * SEC EDGAR — Form 4 ישיר (data.sec.gov / efts.sec.gov).
 * נתונים ציבוריים; User-Agent חובה; ~10 req/s.
 */

export interface EdgarInsiderRow {
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
}

function edgarUserAgent(): string {
  return (
    Deno.env.get('SEC_EDGAR_USER_AGENT')?.trim() ||
    'DarkPoolApp/1.0 (contact@darkpool.site)'
  );
}

function edgarHeaders(): Record<string, string> {
  return {
    'User-Agent': edgarUserAgent(),
    Accept: 'application/json, text/xml, application/xml, */*',
  };
}

function padCik(cik: string | number): string {
  const n = String(cik).replace(/\D/g, '');
  return n.padStart(10, '0');
}

function cikPath(cik: string | number): string {
  return String(Number(String(cik).replace(/\D/g, '')));
}

function accessionNoDashes(adsh: string): string {
  return adsh.replace(/-/g, '');
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface EftsHit {
  adsh?: string;
  ciks?: string[];
  tickers?: string[];
  display_names?: string[];
  file_date?: string;
  form?: string;
}

export async function fetchEdgarForm4InsiderTrades(
  sinceIso: string,
  opts: { maxFilings?: number } = {}
): Promise<EdgarInsiderRow[]> {
  const sinceDate = sinceIso.slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);
  const maxFilings = Math.min(120, Math.max(10, opts.maxFilings ?? 60));
  const hits = await searchEftsForm4(sinceDate, endDate, maxFilings);

  const out: EdgarInsiderRow[] = [];
  for (const hit of hits) {
    try {
      const rows = await parseFilingTransactions(hit);
      out.push(...rows);
    } catch (e) {
      console.warn('secEdgar filing skip', hit.adsh, e);
    }
    await delay(130);
  }

  return dedupeRows(out);
}

async function searchEftsForm4(
  startdt: string,
  enddt: string,
  maxFilings: number
): Promise<EftsHit[]> {
  const hits: EftsHit[] = [];
  const size = 50;
  let from = 0;

  while (hits.length < maxFilings) {
    const url = new URL('https://efts.sec.gov/LATEST/search-index');
    url.searchParams.set('forms', '4');
    url.searchParams.set('dateRange', 'custom');
    url.searchParams.set('startdt', startdt);
    url.searchParams.set('enddt', enddt);
    url.searchParams.set('from', String(from));
    url.searchParams.set('size', String(size));

    const res = await fetch(url.toString(), { headers: edgarHeaders() });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`secEdgar efts ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      hits?: { hits?: Array<{ _source?: EftsHit; _id?: string }> };
    };
    const batch = json.hits?.hits ?? [];
    if (!batch.length) break;

    for (const row of batch) {
      const src = row._source ?? {};
      if (!src.adsh && row._id) src.adsh = row._id.split(':')[0];
      hits.push(src);
      if (hits.length >= maxFilings) break;
    }

    if (batch.length < size) break;
    from += size;
    await delay(150);
  }

  return hits;
}

async function parseFilingTransactions(hit: EftsHit): Promise<EdgarInsiderRow[]> {
  const adsh = String(hit.adsh ?? '').trim();
  const cikRaw = hit.ciks?.[0];
  if (!adsh || !cikRaw) return [];

  const cik = cikPath(cikRaw);
  const adshClean = accessionNoDashes(adsh);
  const indexUrl =
    `https://www.sec.gov/Archives/edgar/data/${cik}/${adshClean}/${adshClean}-index.json`;

  const indexRes = await fetch(indexUrl, { headers: edgarHeaders() });
  if (!indexRes.ok) return [];
  const indexJson = (await indexRes.json()) as {
    directory?: { item?: Array<{ name?: string; type?: string }> };
  };

  const items = indexJson.directory?.item ?? [];
  const xmlName =
    items.find((i) => /form4|ownership/i.test(String(i.name ?? '')) && /\.xml$/i.test(String(i.name)))?.name ||
    items.find((i) => /\.xml$/i.test(String(i.name ?? '')))?.name;

  if (!xmlName) return [];

  const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${adshClean}/${xmlName}`;
  const xmlRes = await fetch(xmlUrl, { headers: edgarHeaders() });
  if (!xmlRes.ok) return [];

  const xml = await xmlRes.text();
  return parseForm4Xml(xml, {
    adsh,
    cik: padCik(cikRaw),
    ticker: (hit.tickers?.[0] ?? '').toUpperCase(),
    company_name: hit.display_names?.[0] ?? null,
    file_date: hit.file_date ?? new Date().toISOString().slice(0, 10),
  });
}

function parseForm4Xml(
  xml: string,
  meta: {
    adsh: string;
    cik: string;
    ticker: string;
    company_name: string | null;
    file_date: string;
  }
): EdgarInsiderRow[] {
  const issuerTicker =
    meta.ticker ||
    tagText(xml, 'issuerTradingSymbol')?.toUpperCase().slice(0, 8) ||
    'UNK';
  const issuerName = meta.company_name || tagText(xml, 'issuerName') || null;

  const ownerName =
    [tagText(xml, 'rptOwnerName'), tagText(xml, 'rptOwnerCik')]
      .filter(Boolean)
      .join(' ')
      .trim() || tagText(xml, 'rptOwnerName') || 'Insider';

  const ownerCik = tagText(xml, 'rptOwnerCik') || null;
  const role = buildRole(xml);
  const filed = tagText(xml, 'periodOfReport') || meta.file_date;

  const blocks = xml.split(/<nonDerivativeTransaction>/i).slice(1);
  const rows: EdgarInsiderRow[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].split(/<\/nonDerivativeTransaction>/i)[0] ?? blocks[i];
    const code = (tagText(block, 'transactionCode') || 'P').toUpperCase();
    if (!['P', 'S', 'A', 'M', 'G', 'F', 'O', 'D'].includes(code)) continue;

    const shares = numTag(block, 'transactionShares');
    const price = numTag(block, 'transactionPricePerShare');
    const txDate = tagText(block, 'transactionDate')?.slice(0, 10) || filed.slice(0, 10);
    const value = shares > 0 && price > 0 ? Math.round(shares * price * 100) / 100 : 0;

    rows.push({
      external_id: `edgar:${meta.adsh}:${i}:${code}:${txDate}`,
      ticker: issuerTicker,
      company_name: issuerName,
      insider_cik: ownerCik,
      insider_name: ownerName,
      insider_role: role,
      transaction_type: code as EdgarInsiderRow['transaction_type'],
      shares,
      price,
      value,
      filed_at: `${meta.file_date}T12:00:00Z`,
      transaction_date: txDate,
    });
  }

  return rows.filter((r) => r.ticker && r.ticker !== 'UNK');
}

function tagText(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const m = xml.match(re);
  return m?.[1]?.trim() || null;
}

function numTag(xml: string, tag: string): number {
  const raw = tagText(xml, tag);
  if (!raw) return 0;
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function buildRole(xml: string): string | null {
  const parts: string[] = [];
  if (/true/i.test(tagText(xml, 'isDirector') ?? '')) parts.push('Director');
  if (/true/i.test(tagText(xml, 'isOfficer') ?? '')) {
    parts.push(tagText(xml, 'officerTitle') || 'Officer');
  }
  if (/true/i.test(tagText(xml, 'isTenPercentOwner') ?? '')) parts.push('10% Owner');
  return parts.length ? parts.join(' · ') : null;
}

function dedupeRows(rows: EdgarInsiderRow[]): EdgarInsiderRow[] {
  const map = new Map<string, EdgarInsiderRow>();
  for (const r of rows) {
    map.set(r.external_id, r);
  }
  return Array.from(map.values());
}
