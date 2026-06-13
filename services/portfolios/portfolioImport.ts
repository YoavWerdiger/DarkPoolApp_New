/**
 * portfolioImport.ts
 * --------------------------------------------------------------------------
 * ייבוא טרנזקציות מ-CSV (XLSX יוסף בעתיד עם הוספת `xlsx` package).
 *
 * תומך בפורמט תואם TradingView:
 *   Symbol, Type, Date, Quantity, Price, Commission, Currency, Notes
 *   Type: BUY/SELL/DEPOSIT/WITHDRAWAL/FEE/DIVIDEND
 *
 * וגם בפורמט גמיש – מזהה אוטומטית את העמודות (case-insensitive, partial match).
 */

import type {
  AnyTransactionInsert,
  AssetType,
  TransactionType,
} from '../../screens/Portfolios/portfolioTypes';

// ---------------------------------------------------------------------------
// CSV parser - תומך ב-quoted values וב-comma escapes
// ---------------------------------------------------------------------------

function parseCsvLine(line: string, delimiter = ','): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  out.push(current);
  return out.map((s) => s.trim());
}

function detectDelimiter(headerLine: string): string {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = 0;
  for (const c of candidates) {
    const count = (headerLine.match(new RegExp(`\\${c}`, 'g')) || []).length;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Column mapping - מזהה אילו עמודות עוסקות במה
// ---------------------------------------------------------------------------

interface ColumnMap {
  symbol: number;
  type: number;
  date: number;
  quantity: number;
  price: number;
  commission: number;
  amount: number;
  currency: number;
  notes: number;
  asset_type: number;
}

const HEADER_ALIASES: Record<keyof ColumnMap, string[]> = {
  symbol: ['symbol', 'ticker', 'instrument', 'asset', 'נכס', 'סימבול'],
  type: ['type', 'side', 'action', 'transaction', 'סוג'],
  date: ['date', 'datetime', 'time', 'תאריך'],
  quantity: ['quantity', 'qty', 'shares', 'units', 'amount of shares', 'כמות'],
  price: ['price', 'rate', 'מחיר'],
  commission: ['commission', 'fee', 'fees', 'cost', 'עמלה'],
  amount: ['amount', 'value', 'total', 'cash', 'סכום'],
  currency: ['currency', 'ccy', 'מטבע'],
  notes: ['notes', 'comment', 'description', 'memo', 'הערה', 'הערות'],
  asset_type: ['asset type', 'asset_type', 'instrument type', 'category'],
};

function buildColumnMap(headers: string[]): ColumnMap {
  const map: ColumnMap = {
    symbol: -1,
    type: -1,
    date: -1,
    quantity: -1,
    price: -1,
    commission: -1,
    amount: -1,
    currency: -1,
    notes: -1,
    asset_type: -1,
  };
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const key of Object.keys(HEADER_ALIASES) as (keyof ColumnMap)[]) {
    for (let i = 0; i < lower.length; i++) {
      if (HEADER_ALIASES[key].some((alias) => lower[i] === alias)) {
        map[key] = i;
        break;
      }
    }
    if (map[key] === -1) {
      // partial match
      for (let i = 0; i < lower.length; i++) {
        if (
          HEADER_ALIASES[key].some((alias) => lower[i].includes(alias))
        ) {
          map[key] = i;
          break;
        }
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Type/value normalization
// ---------------------------------------------------------------------------

function normalizeType(raw: string): TransactionType | null {
  const v = raw.toLowerCase().trim();
  if (['buy', 'b', 'long', 'קנייה'].includes(v)) return 'buy';
  if (['sell', 's', 'short', 'מכירה'].includes(v)) return 'sell';
  if (['deposit', 'in', 'הפקדה'].includes(v)) return 'deposit';
  if (['withdrawal', 'withdraw', 'out', 'משיכה'].includes(v))
    return 'withdrawal';
  if (['fee', 'tax', 'taxes', 'commission only', 'עמלה'].includes(v))
    return 'fee';
  if (['dividend', 'div', 'דיבידנד'].includes(v)) return 'dividend';
  return null;
}

function normalizeAssetType(raw: string): AssetType {
  const v = raw.toLowerCase().trim();
  if (v.includes('etf')) return 'etf';
  if (v.includes('fund')) return 'fund';
  if (v.includes('forex') || v.includes('fx')) return 'forex';
  if (v.includes('crypto') || v.includes('coin')) return 'crypto';
  return 'stock';
}

function parseNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,\s$₪€]/g, '').replace(/[^\d.\-]/g, '');
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  // נסה ISO ראשית
  const iso = new Date(raw);
  if (!isNaN(iso.getTime())) return iso.toISOString();
  // dd/mm/yyyy או mm/dd/yyyy
  const match = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (match) {
    const [, a, b, c] = match;
    const year = c.length === 2 ? `20${c}` : c;
    // ננחש dd/mm כברירת מחדל (חוץ אם החודש > 12)
    const monthFirst = Number(a) > 12;
    const month = monthFirst ? a : b;
    const day = monthFirst ? b : a;
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ParsedRow {
  rowIndex: number;
  raw: string[];
  ok: boolean;
  error?: string;
  transaction?: AnyTransactionInsert;
}

export interface ParseResult {
  totalRows: number;
  validRows: ParsedRow[];
  invalidRows: ParsedRow[];
  headers: string[];
  columnMap: ColumnMap;
}

/**
 * מקבל טקסט CSV ו-portfolioId, ומחזיר אובייקט עם שורות תקינות ושורות שגויות.
 */
export function parsePortfolioCsv(
  csvText: string,
  portfolioId: string
): ParseResult {
  const text = csvText.replace(/\r\n?/g, '\n').trim();
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      headers: [],
      columnMap: buildColumnMap([]),
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter);
  const columnMap = buildColumnMap(headers);

  const validRows: ParsedRow[] = [];
  const invalidRows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const row: ParsedRow = { rowIndex: i, raw: cols, ok: false };

    const typeRaw = columnMap.type >= 0 ? cols[columnMap.type] : '';
    const type = normalizeType(typeRaw);
    if (!type) {
      row.error = `סוג טרנזקציה לא ידוע: "${typeRaw}"`;
      invalidRows.push(row);
      continue;
    }

    const dateRaw = columnMap.date >= 0 ? cols[columnMap.date] : '';
    const date = parseDate(dateRaw);
    if (!date) {
      row.error = `תאריך לא תקין: "${dateRaw}"`;
      invalidRows.push(row);
      continue;
    }

    const currency =
      (columnMap.currency >= 0 ? cols[columnMap.currency] : '') || 'USD';
    const notes = columnMap.notes >= 0 ? cols[columnMap.notes] : undefined;

    if (type === 'buy' || type === 'sell') {
      const symbol = columnMap.symbol >= 0 ? cols[columnMap.symbol] : '';
      const qty =
        columnMap.quantity >= 0 ? parseNumber(cols[columnMap.quantity]) : null;
      const price =
        columnMap.price >= 0 ? parseNumber(cols[columnMap.price]) : null;
      const commission =
        columnMap.commission >= 0
          ? parseNumber(cols[columnMap.commission]) ?? 0
          : 0;
      if (!symbol || !qty || qty <= 0 || price == null) {
        row.error = 'חסר symbol/quantity/price';
        invalidRows.push(row);
        continue;
      }
      const assetType: AssetType =
        columnMap.asset_type >= 0
          ? normalizeAssetType(cols[columnMap.asset_type])
          : 'stock';
      row.transaction = {
        portfolio_id: portfolioId,
        type,
        symbol: symbol.toUpperCase(),
        asset_type: assetType,
        quantity: qty,
        price,
        commission,
        currency,
        date,
        notes: notes || null,
      };
      row.ok = true;
      validRows.push(row);
      continue;
    }

    if (type === 'deposit' || type === 'withdrawal' || type === 'fee') {
      const amount =
        columnMap.amount >= 0 ? parseNumber(cols[columnMap.amount]) : null;
      if (amount == null || amount < 0) {
        row.error = 'חסר amount';
        invalidRows.push(row);
        continue;
      }
      row.transaction = {
        portfolio_id: portfolioId,
        type,
        amount,
        currency,
        date,
        notes: notes || null,
      };
      row.ok = true;
      validRows.push(row);
      continue;
    }

    if (type === 'dividend') {
      const symbol = columnMap.symbol >= 0 ? cols[columnMap.symbol] : '';
      const amount =
        columnMap.amount >= 0
          ? parseNumber(cols[columnMap.amount])
          : columnMap.price >= 0
          ? parseNumber(cols[columnMap.price])
          : null;
      if (!symbol || amount == null || amount < 0) {
        row.error = 'חסר symbol/amount לדיבידנד';
        invalidRows.push(row);
        continue;
      }
      row.transaction = {
        portfolio_id: portfolioId,
        type: 'dividend',
        symbol: symbol.toUpperCase(),
        amount,
        currency,
        date,
        notes: notes || null,
      };
      row.ok = true;
      validRows.push(row);
      continue;
    }
  }

  return {
    totalRows: lines.length - 1,
    validRows,
    invalidRows,
    headers,
    columnMap,
  };
}

/** דוגמה לכותרות המומלצות לקובץ CSV של ייבוא */
export const RECOMMENDED_CSV_HEADERS = [
  'Symbol',
  'Type',
  'Date',
  'Quantity',
  'Price',
  'Commission',
  'Currency',
  'Notes',
];
