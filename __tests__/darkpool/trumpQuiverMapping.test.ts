/**
 * מיפוי Quiver /beta/bulk/trumpstocktrades — משקף normalizeQuiverIsoDate + לוגיקת Filed/Traded.
 */

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

function parseQuiverTxnSide(raw?: string | null): 'buy' | 'sell' | null {
  const t = (raw || '').toLowerCase();
  if (t.includes('sale') || t.includes('sell')) return 'sell';
  if (t.includes('purchase') || t.includes('buy')) return 'buy';
  return null;
}

/** כמו trumpTradeToCongressRow — Filed לתצוגה, Traded לעסקה */
function mapTrumpSample(t: {
  Ticker?: string;
  Transaction?: string;
  Amount?: string;
  Filed?: string;
  Traded?: string;
}) {
  const ticker = String(t.Ticker ?? '').toUpperCase().trim();
  const side = parseQuiverTxnSide(t.Transaction);
  if (!ticker || !side) return null;
  const txDate = normalizeQuiverIsoDate(t.Traded);
  const filed = normalizeQuiverIsoDate(t.Filed) || txDate;
  const day = txDate || filed;
  if (!day) return null;
  return {
    ticker,
    side,
    transaction_date: day,
    filed_display: filed,
    amount_label: t.Amount?.trim() || null,
  };
}

describe('Quiver trumpstocktrades mapping', () => {
  it('normalizes ISO and MM/DD/YYYY Filed/Traded', () => {
    expect(normalizeQuiverIsoDate('2026-08-22')).toBe('2026-08-22');
    expect(normalizeQuiverIsoDate('2026-08-22T12:00:00Z')).toBe('2026-08-22');
    expect(normalizeQuiverIsoDate('8/22/2026')).toBe('2026-08-22');
  });

  it('maps docs sample: Filed for display, Traded for trade day', () => {
    const row = mapTrumpSample({
      Ticker: 'TEAM',
      Transaction: 'Purchase',
      Amount: '$1,001 - $15,000',
      Filed: '2026-08-22',
      Traded: '2026-06-23',
    });
    expect(row).toEqual({
      ticker: 'TEAM',
      side: 'buy',
      transaction_date: '2026-06-23',
      filed_display: '2026-08-22',
      amount_label: '$1,001 - $15,000',
    });
  });

  it('parses Purchase/Sale like Quiver docs', () => {
    expect(parseQuiverTxnSide('Purchase')).toBe('buy');
    expect(parseQuiverTxnSide('Sale')).toBe('sell');
  });
});
