/**
 * נרמול shapes של Quiver congress — משקף normalizeCongressTrade ב־quiverQuant (edge)
 * ואת גזירת transaction_date / filed ב־quiverToCongressRow (congressFeedBuild).
 *
 * שמות השדות מאומתים מול https://api.quiverquant.com/docs/schema.json:
 *   CongressionalTrade   — Representative · TransactionDate · ReportDate
 *   HouseTrade           — Representative · Date            · ReportDate
 *   SenateTrade          — Senator        · Date            · ReportDate
 *   CongressionalTradeV2 — Name           · Traded          · Filed
 */

interface QuiverCongressTrade {
  Representative?: string;
  Senator?: string;
  Name?: string;
  BioGuideID?: string;
  ReportDate?: string;
  TransactionDate?: string;
  Date?: string;
  Filed?: string;
  Traded?: string;
  Ticker?: string;
  Transaction?: string;
  Range?: string;
  Trade_Size_USD?: string;
  Amount?: string;
  House?: string;
  Chamber?: string;
  Description?: string | null;
  Company?: string;
  last_modified?: string;
}

function normalizeCongressTrade(row: QuiverCongressTrade): QuiverCongressTrade {
  return {
    ...row,
    Representative: row.Representative || row.Senator || row.Name,
    ReportDate: row.ReportDate || row.Filed,
    TransactionDate: row.TransactionDate || row.Traded || row.Date,
    Range: row.Range || row.Trade_Size_USD || row.Amount,
    Amount: row.Amount || row.Trade_Size_USD,
    House: row.House || row.Chamber,
    Description: row.Description ?? row.Company ?? null,
  };
}

/** תת-קבוצה של quiverToCongressRow — מה שנכתב בפועל ל-dark_pool_congress_trades */
function toCongressRow(t: QuiverCongressTrade) {
  const politician_name = String(t.Representative ?? '').trim() || 'פוליטיקאי';
  const txDate = String(t.TransactionDate ?? '').slice(0, 10);
  const filed = String(t.ReportDate ?? t.last_modified ?? txDate).slice(0, 10);
  const day = (txDate || filed).slice(0, 10);
  return {
    politician_name,
    transaction_date: day,
    filed_at_date: filed || day,
    amount_label: t.Range?.trim() || null,
    chamber: t.House ?? null,
  };
}

describe('normalizeCongressTrade — Quiver shapes', () => {
  it('SenateTrade: Senator לשם, Date לתאריך העסקה (לא ReportDate)', () => {
    const row = normalizeCongressTrade({
      Senator: 'Tommy Tuberville',
      BioGuideID: 'T000278',
      ReportDate: '2026-08-14T00:00:00Z',
      Date: '2026-07-28T00:00:00Z',
      Ticker: 'NVDA',
      Transaction: 'Purchase',
      Range: '$1,001 - $15,000',
      House: 'Senate',
    });

    expect(row.Representative).toBe('Tommy Tuberville');
    expect(row.TransactionDate).toBe('2026-07-28T00:00:00Z');
    expect(row.ReportDate).toBe('2026-08-14T00:00:00Z');

    expect(toCongressRow(row)).toEqual({
      politician_name: 'Tommy Tuberville',
      transaction_date: '2026-07-28',
      filed_at_date: '2026-08-14',
      amount_label: '$1,001 - $15,000',
      chamber: 'Senate',
    });
  });

  it('HouseTrade: Representative נשמר, Date הוא תאריך העסקה', () => {
    const row = normalizeCongressTrade({
      Representative: 'Nancy Pelosi',
      BioGuideID: 'P000197',
      ReportDate: '2026-08-14T00:00:00Z',
      Date: '2026-07-28T00:00:00Z',
      Ticker: 'AAPL',
      Transaction: 'Sale',
      Range: '$500,001 - $1,000,000',
      House: 'Representatives',
    });

    expect(row.Representative).toBe('Nancy Pelosi');
    expect(toCongressRow(row).transaction_date).toBe('2026-07-28');
    expect(toCongressRow(row).filed_at_date).toBe('2026-08-14');
  });

  it('CongressionalTradeV2: Name/Traded/Filed + Trade_Size_USD', () => {
    const row = normalizeCongressTrade({
      Name: 'Ro Khanna',
      BioGuideID: 'K000389',
      Traded: '2026-06-23T00:00:00Z',
      Filed: '2026-07-15T00:00:00Z',
      Ticker: 'MSFT',
      Transaction: 'Purchase',
      Trade_Size_USD: '1001',
      Chamber: 'House',
      Company: 'Microsoft Corporation',
    });

    expect(row.Representative).toBe('Ro Khanna');
    expect(row.TransactionDate).toBe('2026-06-23T00:00:00Z');
    expect(row.ReportDate).toBe('2026-07-15T00:00:00Z');
    expect(row.Range).toBe('1001');
    expect(row.House).toBe('House');
    expect(row.Description).toBe('Microsoft Corporation');

    expect(toCongressRow(row).transaction_date).toBe('2026-06-23');
  });

  it('CongressionalTrade (V1) ללא רגרסיה — TransactionDate מנצח', () => {
    const row = normalizeCongressTrade({
      Representative: 'John Curtis',
      BioGuideID: 'C001114',
      ReportDate: '2026-08-14T00:00:00Z',
      TransactionDate: '2026-07-28T00:00:00Z',
      Date: '2026-01-01T00:00:00Z',
      Traded: '2026-02-02T00:00:00Z',
      Ticker: 'TSLA',
      Transaction: 'Purchase',
      Range: '$15,001 - $50,000',
    });

    expect(row.TransactionDate).toBe('2026-07-28T00:00:00Z');
    expect(row.Representative).toBe('John Curtis');
  });

  it('הבאג שתוקן: בלי Senator/Date שורת Senate מאבדת שם ומקבלת תאריך דיווח', () => {
    const senate = {
      Senator: 'Sheldon Whitehouse',
      ReportDate: '2026-08-14T00:00:00Z',
      Date: '2026-07-28T00:00:00Z',
      Ticker: 'JPM',
      Transaction: 'Purchase',
    };

    // המצב הקודם: Representative/TransactionDate בלבד
    const before = toCongressRow({
      ...senate,
      Representative: undefined,
      TransactionDate: undefined,
    });
    expect(before.politician_name).toBe('פוליטיקאי');
    expect(before.transaction_date).toBe('2026-08-14'); // ReportDate כתאריך עסקה

    const after = toCongressRow(normalizeCongressTrade(senate));
    expect(after.politician_name).toBe('Sheldon Whitehouse');
    expect(after.transaction_date).toBe('2026-07-28');
  });
});

/**
 * שדות התשואה של Quiver — משקף parseQuiverReturnPct ב-congressFeedBuild (edge).
 * הם חוזרים בכל קריאת congresstrading ונשמרים מעתה ב-3 עמודות חדשות.
 */
describe('parseQuiverReturnPct — ExcessReturn / PriceChange / SPYChange', () => {
  function parseQuiverReturnPct(raw: unknown): number | null {
    if (raw == null) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    const s = String(raw).trim().replace(/%/g, '').replace(/,/g, '');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  it('שומר מספרים כפי שהדוקס מתעדים (אחוזים)', () => {
    expect(parseQuiverReturnPct(24.11)).toBe(24.11);
    expect(parseQuiverReturnPct(-5.69)).toBe(-5.69);
  });

  it('סובל גם את פורמט ה-string שנצפה ב-trumpstocktrades ("224.73%")', () => {
    expect(parseQuiverReturnPct('224.73%')).toBe(224.73);
    expect(parseQuiverReturnPct('1,024.5')).toBe(1024.5);
  });

  it('חוסר נתון נשאר null — לעולם לא 0', () => {
    expect(parseQuiverReturnPct(null)).toBeNull();
    expect(parseQuiverReturnPct(undefined)).toBeNull();
    expect(parseQuiverReturnPct('')).toBeNull();
    expect(parseQuiverReturnPct('n/a')).toBeNull();
    expect(parseQuiverReturnPct(Number.NaN)).toBeNull();
  });

  it('0 אמיתי נשמר כ-0 ולא מתבלבל עם "חסר"', () => {
    expect(parseQuiverReturnPct(0)).toBe(0);
    expect(parseQuiverReturnPct('0%')).toBe(0);
  });
});

describe('formatQuiverDateParam — פרמטרי תאריך של Quiver (YYYYMMDD)', () => {
  function normalizeQuiverIsoDate(raw?: string | null): string | null {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mdy) {
      const mm = mdy[1].padStart(2, '0');
      const dd = mdy[2].padStart(2, '0');
      return `${mdy[3]}-${mm}-${dd}`;
    }
    const t = Date.parse(s);
    if (Number.isFinite(t)) return new Date(t).toISOString().slice(0, 10);
    return null;
  }

  function formatQuiverDateParam(
    raw?: string | number | null
  ): string | undefined {
    if (raw == null) return undefined;
    const s = String(raw).trim();
    if (!s) return undefined;
    if (/^\d{8}$/.test(s)) return s;
    const iso = normalizeQuiverIsoDate(s);
    return iso ? iso.replace(/-/g, '') : undefined;
  }

  it('ISO / ISO datetime / YYYYMMDD כולם מתורגמים לפורמט הדוקס', () => {
    expect(formatQuiverDateParam('2026-09-15')).toBe('20260915');
    expect(formatQuiverDateParam('2026-09-15T00:00:00Z')).toBe('20260915');
    expect(formatQuiverDateParam('20260915')).toBe('20260915');
  });

  it('ריק / לא-תאריך → undefined (הפרמטר לא נשלח)', () => {
    expect(formatQuiverDateParam(undefined)).toBeUndefined();
    expect(formatQuiverDateParam(null)).toBeUndefined();
    expect(formatQuiverDateParam('')).toBeUndefined();
    expect(formatQuiverDateParam('most_recent')).toBeUndefined();
  });
});
