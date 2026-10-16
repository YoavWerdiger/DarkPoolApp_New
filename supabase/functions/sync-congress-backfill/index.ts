/**
 * sync-congress-backfill — השלמת היסטוריית עסקאות לכל חברי הקונגרס שדיווחו (לפי רשימת Quiver),
 * לא רק ל-20 ה«מאוצרים». כל ריצה מעבדת כמה פוליטיקאים (לפי מספר עסקאות), ושומרת סטטוס
 * ב-congress_backfill_state. אחרי ההשלמה — הפיד השוטף (sync-congress-trades) מוסיף עסקאות חדשות.
 * שרת בלבד (מפתח service).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { isServiceCaller, serviceOnlyDenied } from '../_shared/serviceOnly.ts';
import {
  applyQuiverPoliticianImages,
  buildCuratedCongressHistoryRows,
} from '../_shared/congressFeedBuild.ts';
import {
  createServiceSupabase,
  loadSnapshot,
  upsertCongressTradesToDb,
} from '../_shared/uwDbCache.ts';
import {
  QUIVER_POLITICIANS_CACHE_KEY,
  resolveQuiverApiKey,
  type QuiverPoliticiansCachePayload,
} from '../_shared/quiverQuant.ts';

const TIME_BUDGET_MS = 110_000;

serve(async (req) => {
  if (!isServiceCaller(req)) return serviceOnlyDenied();
  const started = Date.now();
  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.max(1, Math.min(Number(body.limit) || 5, 25));

  const apiKey = resolveQuiverApiKey();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'QUIVER_API_KEY missing' }), { status: 500 });
  }

  const supabase = createServiceSupabase();
  const { data: pending, error: pendErr } = await supabase.rpc('congress_backfill_pending', {
    p_limit: limit,
  });
  if (pendErr) {
    return new Response(JSON.stringify({ error: pendErr.message }), { status: 500 });
  }

  let politicians: QuiverPoliticiansCachePayload['politicians'] = [];
  try {
    const polSnap = await loadSnapshot<QuiverPoliticiansCachePayload>(
      supabase,
      QUIVER_POLITICIANS_CACHE_KEY,
      7 * 24 * 60 * 60 * 1000
    );
    politicians = polSnap?.payload?.politicians ?? [];
  } catch {
    /* תמונות — לא קריטי */
  }

  const results: Array<{ bioguide: string; status: string; rows: number }> = [];
  let stopped: string | null = null;

  for (const p of (pending ?? []) as Array<{ bioguide: string; name: string; trade_count: number }>) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      stopped = 'time_budget';
      break;
    }
    let status = 'ok';
    let errText: string | null = null;
    let upserted = 0;
    try {
      let rows = await buildCuratedCongressHistoryRows(apiKey, [p.bioguide], {
        bulkMaxPages: 20,
        rowLimit: 3000,
      });
      rows = applyQuiverPoliticianImages(rows, politicians);
      if (rows.length) {
        upserted = await upsertCongressTradesToDb(supabase, rows);
      } else {
        status = 'empty';
      }
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      // מגבלת קצב / מכסה — עוצרים; הפוליטיקאי יעובד בריצה הבאה (לא נרשם)
      if (/429|rate|limit|quota/i.test(msg)) {
        stopped = `quiver_limit: ${msg.slice(0, 120)}`;
        break;
      }
      status = 'error';
      errText = msg.slice(0, 300);
    }
    await supabase.from('congress_backfill_state').upsert({
      bioguide: p.bioguide,
      name: p.name,
      trade_count: p.trade_count,
      status,
      rows_upserted: upserted,
      error: errText,
      processed_at: new Date().toISOString(),
    });
    results.push({ bioguide: p.bioguide, status, rows: upserted });
  }

  return new Response(
    JSON.stringify({ processed: results.length, results, stopped, ms: Date.now() - started }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
