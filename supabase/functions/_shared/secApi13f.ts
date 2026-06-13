/**
 * sec-api.io — Form 13F holdings
 * POST https://api.sec-api.io/form-13f/holdings
 */

export interface SecApi13fHolding {
  ticker: string;
  issuer_name: string | null;
  cusip: string | null;
  shares: number;
  value_usd: number;
}

export interface SecApi13fFiling {
  cik: string;
  filing_date: string;
  report_date: string | null;
  manager_name: string | null;
  holdings: SecApi13fHolding[];
  total_value_usd: number;
}

interface RawHolding {
  ticker?: string;
  nameOfIssuer?: string;
  cusip?: string;
  value?: number;
  sshPrnamt?: number;
  sshPrnamtType?: string;
}

export async function fetchLatest13fForCik(
  apiKey: string,
  cik: string
): Promise<SecApi13fFiling | null> {
  const filings = await fetch13fHistoryForCik(apiKey, cik, 1);
  return filings[0] ?? null;
}

/** היסטוריית דיווחי 13F (רבעונים) — לגרף שווי תיק */
export async function fetch13fHistoryForCik(
  apiKey: string,
  cik: string,
  limit = 12
): Promise<SecApi13fFiling[]> {
  const digits = cik.replace(/\D/g, '');
  const query = digits ? `cik:${digits}` : `cik:${cik.trim()}`;

  const res = await fetch('https://api.sec-api.io/form-13f/holdings', {
    method: 'POST',
    headers: {
      Authorization: apiKey.trim(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query,
      from: 0,
      size: Math.min(24, Math.max(1, limit)),
      sort: [{ filedAt: { order: 'desc' } }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`sec-api 13F ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const rows = json.data ?? [];
  const out: SecApi13fFiling[] = [];
  const seenDates = new Set<string>();

  for (const row of rows) {
    const filing = parse13fRow(row, digits || cik);
    if (!filing || !filing.holdings.length) continue;
    if (seenDates.has(filing.filing_date)) continue;
    seenDates.add(filing.filing_date);
    out.push(filing);
  }

  return out.sort((a, b) => a.filing_date.localeCompare(b.filing_date));
}

function parse13fRow(
  row: Record<string, unknown>,
  cikFallback: string
): SecApi13fFiling | null {
  const rawHoldings = extractRawHoldings(row);
  const holdings: SecApi13fHolding[] = [];
  let total = 0;

  for (const h of rawHoldings) {
    const issuer = String(h.nameOfIssuer ?? '').trim() || null;
    const cusip = String(h.cusip ?? '').trim() || null;
    let ticker = String(h.ticker ?? '').toUpperCase().trim();
    if (!ticker && cusip) ticker = cusip;
    if (!ticker && issuer) {
      const m = issuer.match(/\(([A-Z]{1,5})\)/);
      if (m) ticker = m[1];
    }
    if (!ticker) continue;

    const valueRaw = Number(h.value) || 0;
    const value_usd = valueRaw >= 1_000_000 ? valueRaw : valueRaw * 1000;
    const shares = Number(h.sshPrnamt) || 0;
    if (value_usd <= 0) continue;

    total += value_usd;
    holdings.push({
      ticker: ticker.slice(0, 12),
      issuer_name: issuer,
      cusip,
      shares,
      value_usd,
    });
  }

  holdings.sort((a, b) => b.value_usd - a.value_usd);
  if (!holdings.length) return null;

  return {
    cik: String(row.cik ?? cikFallback),
    filing_date: String(row.filedAt ?? row.filingDate ?? '').slice(0, 10),
    report_date: row.periodOfReport
      ? String(row.periodOfReport).slice(0, 10)
      : row.reportDate
        ? String(row.reportDate).slice(0, 10)
        : null,
    manager_name: String(row.name ?? row.companyName ?? '').trim() || null,
    holdings,
    total_value_usd: total,
  };
}

function extractRawHoldings(row: Record<string, unknown>): RawHolding[] {
  if (Array.isArray(row.holdings)) return row.holdings as RawHolding[];

  const table = row.informationTable ?? row.infotable ?? row.infoTable;
  if (table && typeof table === 'object') {
    const t = table as Record<string, unknown>;
    if (Array.isArray(t.holdings)) return t.holdings as RawHolding[];
    if (Array.isArray(t.holding)) return t.holding as RawHolding[];
  }

  if (Array.isArray(row.holding)) return row.holding as RawHolding[];

  return [];
}
