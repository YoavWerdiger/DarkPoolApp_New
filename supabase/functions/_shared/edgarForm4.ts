/**
 * Form 4 מקורי מ-SEC EDGAR — יתרה לכל «קו אחזקה» בנפרד.
 * form4api מחזיר sharesOwnedAfter בלי לציין לאיזה קו הוא שייך (מניה רגילה / Class B / RSU / נאמנות),
 * ולכן היתרות שלו קופצות בין קווים. כאן כל קו מזוהה: טבלה (רגיל/נגזר), סוג נייר, ישיר/עקיף ודרך מה.
 * Parser ללא תלויות (regex) — מבנה ה-XML של Form 4 קבוע.
 */

export const SEC_USER_AGENT = 'DarkPool App insider-ownership contact@darkpool.app';

export interface Form4OwnershipLine {
  line_key: string;
  is_derivative: boolean;
  security_title: string;
  ownership: 'D' | 'I';
  nature: string | null;
  shares_owned: number;
  as_of_date: string;
}

export interface ParsedForm4Ownership {
  ticker: string | null;
  period_of_report: string | null;
  lines: Form4OwnershipLine[];
}

function tagBlock(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : null;
}

/** <tag><value>X</value>…</tag> או <tag>X</tag> */
function valueOf(xml: string, tag: string): string | null {
  const block = tagBlock(xml, tag);
  if (block == null) return null;
  const v = tagBlock(block, 'value');
  const raw = (v ?? (block.includes('<') ? '' : block)).trim();
  return raw ? decodeXml(raw) : null;
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function normTitle(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function form4LineKey(isDerivative: boolean, title: string, ownership: string, nature: string | null): string {
  return [
    isDerivative ? 'd' : 'n',
    normTitle(title).toLowerCase(),
    ownership,
    normTitle(nature ?? '').toLowerCase(),
  ].join(':');
}

/** מקבל XML של ownershipDocument או את קובץ ה-.txt המלא של ההגשה */
export function parseForm4Ownership(docText: string): ParsedForm4Ownership | null {
  const doc = tagBlock(docText, 'ownershipDocument');
  if (doc == null) return null;

  const tickerRaw = (tagBlock(doc, 'issuerTradingSymbol') ?? '').trim().toUpperCase();
  const ticker = tickerRaw && tickerRaw !== 'NONE' && tickerRaw !== 'N/A' ? decodeXml(tickerRaw) : null;
  const period = (tagBlock(doc, 'periodOfReport') ?? '').trim().slice(0, 10) || null;

  const byKey = new Map<string, Form4OwnershipLine>();
  const kinds: Array<[string, boolean]> = [
    ['nonDerivativeTransaction', false],
    ['nonDerivativeHolding', false],
    ['derivativeTransaction', true],
    ['derivativeHolding', true],
  ];

  for (const [tag, isDerivative] of kinds) {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
    for (const m of doc.matchAll(re)) {
      const row = m[1];
      const title = valueOf(row, 'securityTitle');
      const post = tagBlock(row, 'postTransactionAmounts') ?? row;
      const ownedRaw = valueOf(post, 'sharesOwnedFollowingTransaction');
      if (!title || ownedRaw == null) continue;
      const shares = Number(ownedRaw.replace(/,/g, ''));
      if (!Number.isFinite(shares) || shares < 0) continue;

      const natureBlock = tagBlock(row, 'ownershipNature') ?? '';
      const own = (valueOf(natureBlock, 'directOrIndirectOwnership') ?? 'D').toUpperCase() === 'I' ? 'I' : 'D';
      const nature = own === 'I' ? valueOf(natureBlock, 'natureOfOwnership') : null;
      const date = (valueOf(row, 'transactionDate') ?? period ?? '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

      const key = form4LineKey(isDerivative, title, own, nature);
      const prev = byKey.get(key);
      // סדר המסמך כרונולוגי; שורה עם תאריך מאוחר או שווה גוברת
      if (!prev || date >= prev.as_of_date) {
        byKey.set(key, {
          line_key: key,
          is_derivative: isDerivative,
          security_title: normTitle(title),
          ownership: own,
          nature: nature ? normTitle(nature) : null,
          shares_owned: shares,
          as_of_date: date,
        });
      }
    }
  }

  return { ticker, period_of_report: period, lines: Array.from(byKey.values()) };
}

export function edgarFilingTxtUrl(cik: string, accession: string): string {
  const cikNum = String(Number(cik.replace(/\D/g, '')));
  return `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accession.replace(/-/g, '')}/${accession}.txt`;
}

/**
 * מניות — זה ה«תיק»: טבלה I, וגם Class B/C מטבלה II (מניות מייסדים). RSU / אופציות לא נספרים.
 * קווים עקיפים (נאמנות, LLC) נספרים — הם בבעלות האינסיידר.
 */
export function isCommonEquityLine(l: { is_derivative: boolean; security_title: string | null }): boolean {
  const t = (l.security_title ?? '').toLowerCase();
  // מניות מייסדים (Class B/C) מדווחות בטבלה II כי הן ניתנות להמרה 1:1 — אבל הן מניות שבבעלות מלאה
  // (צוקרברג, קארפ...). אופציות / RSU / יחידות — לא.
  if (l.is_derivative) {
    return /\bclass\s+[b-z]\b/.test(t) && /\b(common|ordinary|capital)\b/.test(t) && !/\b(options?|units?|rights?|warrants?)\b/.test(t);
  }
  if (/\b(note|warrant|option|right|debenture|bond|unit[s]? of limited|preferred)\b/.test(t)) return false;
  return true;
}
