/**
 * sec-api.io — Form 3/4/5 insider transactions
 * POST https://api.sec-api.io/insider-trading
 * Auth: Authorization: YOUR_API_KEY (ללא Bearer)
 */

export interface SecApiInsiderRow {
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

interface SecApiFiling {
  accessionNo?: string;
  filedAt?: string;
  documentType?: string;
  periodOfReport?: string;
  issuer?: { cik?: string; name?: string; tradingSymbol?: string };
  reportingOwner?: {
    cik?: string;
    name?: string;
    relationship?: {
      isDirector?: boolean;
      isOfficer?: boolean;
      officerTitle?: string;
      isTenPercentOwner?: boolean;
      isOther?: boolean;
      otherText?: string;
    };
  };
  footnotes?: Array<{ id?: string; text?: string }>;
  nonDerivativeTable?: {
    transactions?: SecApiNonDerivativeTx[];
  };
}

interface SecApiNonDerivativeTx {
  securityTitle?: string;
  transactionDate?: string;
  coding?: { code?: string; footnoteId?: string[] };
  amounts?: {
    shares?: number;
    pricePerShare?: number;
    acquiredDisposedCode?: string;
  };
}

interface SecApiSearchResponse {
  transactions?: SecApiFiling[];
  total?: { value?: number; relation?: string };
}

export async function fetchSecApiInsiderPurchases(
  apiKey: string,
  sinceIso: string,
  opts: { maxFilings?: number } = {}
): Promise<SecApiInsiderRow[]> {
  const sinceDate = sinceIso.slice(0, 10);
  const query = `nonDerivativeTable.transactions.coding.code:P AND filedAt:[${sinceDate} TO *]`;
  const maxFilings = Math.min(500, Math.max(50, opts.maxFilings ?? 200));
  const out: SecApiInsiderRow[] = [];
  let from = 0;
  const size = 50;

  while (from < maxFilings) {
    const res = await fetch('https://api.sec-api.io/insider-trading', {
      method: 'POST',
      headers: {
        Authorization: apiKey.trim(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        from: String(from),
        size: String(size),
        sort: [{ filedAt: { order: 'desc' } }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`sec-api.io ${res.status}: ${body.slice(0, 280)}`);
    }

    const json = (await res.json()) as SecApiSearchResponse;
    const filings = json.transactions ?? [];
    if (!filings.length) break;

    for (const filing of filings) {
      out.push(...mapSecApiFiling(filing));
    }

    if (filings.length < size) break;
    from += size;
    await delay(120);
  }

  return out;
}

function mapSecApiFiling(filing: SecApiFiling): SecApiInsiderRow[] {
  const ticker = filing.issuer?.tradingSymbol?.trim().toUpperCase();
  if (!ticker) return [];

  const footnoteText = (filing.footnotes ?? [])
    .map((f) => f.text ?? '')
    .join(' ')
    .toLowerCase();
  const is10b51 = footnoteText.includes('10b5-1') || footnoteText.includes('10b5_1');

  const insiderName = filing.reportingOwner?.name?.trim() || null;
  const insiderCik = filing.reportingOwner?.cik?.trim() || null;
  const insiderRole = formatSecApiRole(filing.reportingOwner?.relationship);
  const companyName = filing.issuer?.name?.trim() || null;
  const filedAt = filing.filedAt || filing.periodOfReport || new Date().toISOString();
  const accession = filing.accessionNo?.trim() || '';

  const rows: SecApiInsiderRow[] = [];
  for (const tx of filing.nonDerivativeTable?.transactions ?? []) {
    const code = (tx.coding?.code ?? '').toUpperCase();
    if (code !== 'P') continue;
    const side = (tx.amounts?.acquiredDisposedCode ?? 'A').toUpperCase();
    if (side === 'D') continue;
    if (is10b51) continue;

    const shares = Number(tx.amounts?.shares) || 0;
    if (shares <= 0) continue;
    const price = tx.amounts?.pricePerShare != null ? Number(tx.amounts.pricePerShare) : 0;
    const txDate = (tx.transactionDate ?? filing.periodOfReport ?? filedAt).slice(0, 10);
    const external_id = accession
      ? `secapi:${accession}:${insiderCik ?? 'na'}:${txDate}:${shares}:${price}`
      : `secapi:${ticker}:${insiderCik ?? 'na'}:${txDate}:${shares}:${price}`;

    rows.push({
      external_id,
      ticker,
      company_name: companyName,
      insider_cik: insiderCik,
      insider_name: insiderName,
      insider_role: insiderRole,
      transaction_type: 'P',
      shares,
      price,
      value: shares * price,
      filed_at: filedAt,
      transaction_date: txDate,
    });
  }
  return rows;
}

function formatSecApiRole(
  rel?: {
    isDirector?: boolean;
    isOfficer?: boolean;
    officerTitle?: string;
    isTenPercentOwner?: boolean;
    isOther?: boolean;
    otherText?: string;
  }
): string | null {
  if (!rel) return null;
  if (rel.officerTitle?.trim()) return rel.officerTitle.trim();
  if (rel.isDirector) return 'Director';
  if (rel.isTenPercentOwner) return '10% Owner';
  if (rel.otherText?.trim()) return rel.otherText.trim();
  if (rel.isOfficer) return 'Officer';
  return null;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
