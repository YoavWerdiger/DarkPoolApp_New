import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';

/**
 * sync-sp500-constituents
 * ────────────────────────
 * שולף את הרכיבים הנוכחיים של S&P 500 ומסנכרן עם הטבלה
 * `sp500_constituents`. הטריגר ב-`earnings_calendar` משתמש בטבלה
 * הזאת כדי לסנן הוספות אוטומטית.
 *
 * Source: https://datahub.io/core/s-and-p-500-companies/r/constituents.csv
 *   - מקור ציבורי, ללא מפתח, מתעדכן באופן אוטומטי מ-Wikipedia.
 *   - פורמט: CSV עם עמודות Symbol,Security,GICS Sector,GICS Sub-Industry,...
 *
 * אחרי upsert מבצע:
 *   1. מחיקת רכיבים שכבר לא נמצאים ב-S&P 500 (delisted / removed).
 *   2. קריאה ל-`cleanup_non_sp500_earnings()` כדי לנקות שורות
 *      ב-earnings_calendar שכבר לא רלוונטיות.
 *
 * מומלץ לתזמן עם pg_cron: פעם בשבוע (S&P 500 משנים רכיבים נדיר,
 * סדר גודל פעם בחודש-שלושה).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DATAHUB_CSV_URL =
  'https://datahub.io/core/s-and-p-500-companies/r/constituents.csv';

interface Constituent {
  symbol: string; // "AAPL.US"
  ticker: string; // "AAPL"
  name: string | null;
  sector: string | null;
  industry: string | null;
}

/**
 * Minimal CSV parser שמכבד שדות עטופים במרכאות עם פסיקים בפנים.
 * מחזיר מערך של מערכי שורות (מערך עמודות לכל שורה).
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // escape: ""
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\r') {
      // ignore — handle on \n
    } else if (ch === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else {
      cur += ch;
    }
  }

  // tail
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }

  return rows.filter((r) => r.length > 1 && r.some((c) => c.trim().length > 0));
}

async function fetchFromDataHub(): Promise<Constituent[]> {
  const resp = await fetch(DATAHUB_CSV_URL, {
    headers: { Accept: 'text/csv,text/plain,*/*' },
  });
  if (!resp.ok) {
    throw new Error(`DataHub responded ${resp.status} ${resp.statusText}`);
  }
  const csv = await resp.text();
  const rows = parseCsv(csv);

  if (rows.length < 10) {
    throw new Error(`DataHub returned suspiciously few rows: ${rows.length}`);
  }

  const header = rows[0].map((c) => c.trim());
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const iSymbol = idx('Symbol');
  const iName = idx('Security');
  const iSector = idx('GICS Sector');
  const iIndustry = idx('GICS Sub-Industry');

  if (iSymbol < 0) {
    throw new Error('DataHub CSV: Symbol column not found');
  }

  const out: Constituent[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const raw = (cols[iSymbol] ?? '').trim();
    if (!raw) continue;

    // EODHD/Benzinga משתמשים ב-tickers עם נקודות (BRK.B → BRK-B / BRK.B).
    // נשמור גם את הסמל המקורי וגם וריאציה עם hyphen.
    const ticker = raw.replace(/\s+/g, '');
    out.push({
      ticker,
      symbol: `${ticker}.US`,
      name: iName >= 0 ? (cols[iName] ?? '').trim() || null : null,
      sector: iSector >= 0 ? (cols[iSector] ?? '').trim() || null : null,
      industry: iIndustry >= 0 ? (cols[iIndustry] ?? '').trim() || null : null,
    });
  }

  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonError('Missing Supabase configuration', 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log('🚀 Fetching S&P 500 constituents from DataHub…');
    const components = await fetchFromDataHub();

    if (components.length === 0) {
      return jsonError('Source returned no components — aborting', 502);
    }

    console.log(`📊 Received ${components.length} constituents`);

    const rows = components.map((c) => ({
      symbol: c.symbol,
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      industry: c.industry,
      updated_at: new Date().toISOString(),
    }));
    const symbolsNow = rows.map((r) => r.symbol);

    const { error: upsertErr } = await supabase
      .from('sp500_constituents')
      .upsert(rows, { onConflict: 'symbol' });

    if (upsertErr) {
      console.error('❌ Upsert failed:', upsertErr);
      return jsonError(`Upsert failed: ${upsertErr.message}`, 500);
    }

    // הסרת רכיבים שיצאו מהאינדקס (delisted / replaced)
    const inList = symbolsNow.map((s) => `"${s}"`).join(',');
    const { error: delErr, count: deletedCount } = await supabase
      .from('sp500_constituents')
      .delete({ count: 'exact' })
      .not('symbol', 'in', `(${inList})`);

    if (delErr) {
      console.error('⚠️ Stale delete failed:', delErr.message);
    }

    // ניקוי earnings_calendar — מסיר שורות שלא ב-SP500 ושכבר נכנסו לפני הטריגר
    const { data: cleanupResult, error: cleanupErr } = await supabase.rpc(
      'cleanup_non_sp500_earnings',
    );
    if (cleanupErr) {
      console.error('⚠️ cleanup_non_sp500_earnings failed:', cleanupErr.message);
    }

    const summary = {
      success: true,
      synced: rows.length,
      stale_removed: deletedCount ?? 0,
      earnings_cleanup_deleted: cleanupResult ?? 0,
      timestamp: new Date().toISOString(),
    };

    console.log('✅ sync-sp500-constituents finished', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('❌ sync-sp500-constituents error:', err);
    return jsonError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
