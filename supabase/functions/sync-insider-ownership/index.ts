/**
 * sync-insider-ownership — קורא הגשות Form 4 מקוריות מ-SEC EDGAR ושומר יתרה לכל קו אחזקה
 * (insider_ownership_points). רץ ב-cron כל שעה; כל ריצה מעבדת עד `limit` הגשות שעוד לא נקראו
 * (קודם אנשים עם פרופיל, אחר כך החדשות). SEC: עד 10 בקשות בשנייה — כאן ~6.
 * שרת בלבד (מפתח service).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { isServiceCaller, serviceOnlyDenied } from '../_shared/serviceOnly.ts';
import { SEC_USER_AGENT, edgarFilingTxtUrl, parseForm4Ownership } from '../_shared/edgarForm4.ts';

const REQUEST_GAP_MS = 170;
const TIME_BUDGET_MS = 110_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (!isServiceCaller(req)) return serviceOnlyDenied();
  const started = Date.now();

  // cik — סנכרון אינסיידר ספציפי (פרופיל חדש / בדיקה); בלי — תור כללי
  const body = await req.json().catch(() => ({})) as { limit?: number; cik?: string };
  const limit = Math.max(1, Math.min(Number(body.limit) || 150, 500));

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  const { data: pending, error: pendErr } = await supabase.rpc('insider_ownership_pending', {
    p_limit: limit,
    p_cik: body.cik?.trim() || null,
  });
  if (pendErr) {
    return new Response(JSON.stringify({ error: pendErr.message }), { status: 500 });
  }

  let ok = 0;
  let noXml = 0;
  let failed = 0;
  let lines = 0;
  let stoppedReason: string | null = null;

  for (const f of (pending ?? []) as Array<{ accession: string; insider_cik: string; filed_at: string | null }>) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      stoppedReason = 'time_budget';
      break;
    }
    const url = edgarFilingTxtUrl(f.insider_cik, f.accession);
    let status = 'ok';
    let errText: string | null = null;
    let count = 0;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': SEC_USER_AGENT, Accept: 'text/plain' } });
      if (res.status === 429 || res.status === 403) {
        // SEC חוסם/מגביל — עוצרים את הריצה, ההגשה תיקרא בריצה הבאה
        stoppedReason = `sec_${res.status}`;
        await res.body?.cancel();
        break;
      }
      if (!res.ok) {
        status = 'error';
        errText = `http_${res.status}`;
        await res.body?.cancel();
      } else {
        const parsed = parseForm4Ownership(await res.text());
        if (!parsed || !parsed.ticker) {
          status = 'no_xml';
        } else if (parsed.lines.length) {
          const rows = parsed.lines.map((l) => ({
            accession: f.accession,
            line_key: l.line_key,
            insider_cik: f.insider_cik,
            ticker: parsed.ticker!,
            is_derivative: l.is_derivative,
            security_title: l.security_title,
            ownership: l.ownership,
            nature: l.nature,
            shares_owned: l.shares_owned,
            as_of_date: l.as_of_date,
            filed_at: f.filed_at,
          }));
          const { error } = await supabase.from('insider_ownership_points').upsert(rows, {
            onConflict: 'accession,line_key',
          });
          if (error) {
            status = 'error';
            errText = error.message.slice(0, 300);
          } else {
            count = rows.length;
          }
        }
      }
    } catch (e) {
      status = 'error';
      errText = String((e as Error)?.message ?? e).slice(0, 300);
    }

    await supabase.from('insider_filings_parsed').upsert({
      accession: f.accession,
      insider_cik: f.insider_cik,
      status,
      error: errText,
      lines: count,
      parsed_at: new Date().toISOString(),
    });
    if (status === 'ok') ok++;
    else if (status === 'no_xml') noXml++;
    else failed++;
    lines += count;
    await sleep(REQUEST_GAP_MS);
  }

  return new Response(
    JSON.stringify({
      processed: ok + noXml + failed,
      ok,
      no_xml: noXml,
      failed,
      lines,
      stopped: stoppedReason,
      ms: Date.now() - started,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
