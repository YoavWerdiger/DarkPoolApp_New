import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'
import {
  addCalendarDays,
  purgeStaleEstimateRowsNearConfirmed,
} from '../_shared/earnings-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EarningsEntry {
  company_name: string;
  eps_actual?: string | number | null;
  eps_estimate?: string | number | null;
  quarter?: string | null;
  report_date: string;
  report_time?: string | null;
  revenue_actual?: string | number | null;
  revenue_estimate?: string | number | null;
  ticker: string;
}

function parseNumber(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  
  let str = val.toString().trim().toUpperCase();
  let multiplier = 1;
  
  if (str.endsWith('B')) {
    multiplier = 1_000_000_000;
    str = str.slice(0, -1);
  } else if (str.endsWith('M')) {
    multiplier = 1_000_000;
    str = str.slice(0, -1);
  } else if (str.endsWith('K')) {
    multiplier = 1_000;
    str = str.slice(0, -1);
  }
  
  str = str.replace(/[$,]/g, '');
  const num = parseFloat(str);
  
  if (isNaN(num)) return null;
  return num * multiplier;
}

function parseReportTime(reportTime: string | null | undefined): string | null {
  if (!reportTime) return null;
  
  const time = reportTime.toLowerCase();
  if (time.includes('before') || time.includes('pre-market')) {
    return 'BeforeMarket';
  }
  if (time.includes('after') || time.includes('post-market') || time.includes('after market close')) {
    return 'AfterMarket';
  }
  return null;
}

/**
 * חלונות דיווח אמיתיים (שעון ישראל), עם באפר ל-DST:
 * - BMO: ~07:00 ET ≈ 14:00 IDT / 13:00 IST → 12:30–16:45 ישראל (עד פתיחה ~09:30 ET)
 * - AMC: ~16:05 ET ≈ 23:05 IDT / 22:05 IST → 21:30–00:30 ישראל
 *
 * בעבר היה רק 15:30–17:00 (לא חלון BMO) + לילה —
 * ולכן תוצאות BMO הגיעו רק ב-batch של evening sync ב-18:00 ישראל (15:00 UTC).
 */
function isWithinEarningsReleaseWindow(israelHour: number, israelMinute: number): {
  inWindow: boolean;
  windowName: 'bmo' | 'amc' | null;
} {
  const mins = israelHour * 60 + israelMinute;

  const bmoStart = 12 * 60 + 30; // 12:30
  const bmoEnd = 16 * 60 + 45; // 16:45 — covers late BMO through US open
  if (mins >= bmoStart && mins < bmoEnd) {
    return { inWindow: true, windowName: 'bmo' };
  }

  // AMC wraps past midnight
  const amcEveningStart = 21 * 60 + 30; // 21:30
  const amcMorningEnd = 30; // 00:30
  if (mins >= amcEveningStart || mins < amcMorningEnd) {
    return { inWindow: true, windowName: 'amc' };
  }

  return { inWindow: false, windowName: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting Live Earnings Results Update...')

    const now = new Date();
    const israelTimeStr = now.toLocaleString('en-US', { 
      timeZone: 'Asia/Jerusalem',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    const [israelHour, israelMinute] = israelTimeStr.split(':').map(Number);
    const { inWindow, windowName } = isWithinEarningsReleaseWindow(israelHour, israelMinute);

    // אין דיווחים בסופ״ש — לא לקרוא ל-Parse ולהחזיר 500
    const etWeekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
    }).format(now)
    const isWeekend = etWeekday === 'Sat' || etWeekday === 'Sun'

    if (!inWindow || isWeekend) {
      console.log(
        `⏰ Skipping live update (Israel ${israelTimeStr}, ET ${etWeekday}, inWindow=${inWindow}).`,
      )
      return new Response(
        JSON.stringify({
          success: true,
          message: isWeekend
            ? 'Weekend - update skipped'
            : 'Outside earnings release windows - update skipped',
          current_time_israel: israelTimeStr,
          et_weekday: etWeekday,
          release_windows: {
            bmo: '12:30-16:45 Israel time (~07:00–09:30 ET)',
            amc: '21:30-00:30 Israel time (~16:05 ET)',
          },
          updated_count: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Within earnings release window (time: ${israelTimeStr} Israel time - ${windowName} window)`)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // תואם ל-daily-earnings-sync-v2 — לפעמים רק PARSE_BOT_API_KEY מוגדר ב-secrets
    const earningsApiKey = Deno.env.get('EARNINGS_API_KEY') || Deno.env.get('PARSE_BOT_API_KEY')
    const finnhubApiKey = Deno.env.get('FINNHUB_API_KEY')
    const benzingaApiKey = Deno.env.get('BENZINGA_API_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    if (!earningsApiKey && !finnhubApiKey && !benzingaApiKey) {
      throw new Error('Missing EARNINGS_API_KEY / FINNHUB_API_KEY / BENZINGA_API_KEY')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('📡 Fetching today\'s actuals (Parse primary, Finnhub/Benzinga fallback)...')

    let filteredEntries: EarningsEntry[] = []
    let sourceUsed = 'none'

    // 1) Parse OpenAPI: GET update_actuals_for_today (scraper 19f29e4b)
    if (earningsApiKey) {
      const updateUrl = 'https://api.parse.bot/scraper/19f29e4b-4d7f-4a6e-9fd5-61a2a712543d/update_actuals_for_today'
      try {
        const apiResponse = await fetch(updateUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-API-Key': earningsApiKey
          },
        })

        if (!apiResponse.ok) {
          const errorText = await apiResponse.text()
          throw new Error(`Failed to fetch today's actuals: ${apiResponse.status} - ${errorText}`)
        }

        const rawBody = await apiResponse.text()
        let parsedBody: unknown
        try {
          parsedBody = JSON.parse(rawBody)
        } catch {
          throw new Error(`Invalid JSON from Parse update_actuals_for_today: ${rawBody.slice(0, 300)}`)
        }

        if (Array.isArray(parsedBody)) {
          filteredEntries = parsedBody as EarningsEntry[]
        } else if (parsedBody && typeof parsedBody === 'object') {
          const obj = parsedBody as Record<string, unknown>
          if (Array.isArray(obj.data)) filteredEntries = obj.data as EarningsEntry[]
          else if (Array.isArray(obj.entries)) filteredEntries = obj.entries as EarningsEntry[]
          else if (Array.isArray(obj.results)) filteredEntries = obj.results as EarningsEntry[]
          else if (obj.error) {
            throw new Error(`Parse API error: ${String(obj.error)}`)
          } else {
            throw new Error(`Unexpected Parse response shape: keys=${Object.keys(obj).join(',')}`)
          }
        } else {
          throw new Error('Invalid API response format - expected array')
        }
        sourceUsed = 'parse'
      } catch (parseErr) {
        console.warn(
          '⚠️ Parse actuals failed — trying Finnhub/Benzinga:',
          parseErr instanceof Error ? parseErr.message.slice(0, 250) : String(parseErr),
        )
      }
    } else {
      console.warn('⚠️ No Parse key — skipping straight to Finnhub/Benzinga')
    }

    const todayIso = new Date().toISOString().slice(0, 10)

    if (filteredEntries.length === 0 && finnhubApiKey) {
      try {
        const fhUrl =
          `https://finnhub.io/api/v1/calendar/earnings?from=${todayIso}&to=${todayIso}&token=${finnhubApiKey}`
        const fhResp = await fetch(fhUrl)
        const fhText = await fhResp.text()
        if (fhResp.ok) {
          const fhData = JSON.parse(fhText) as { earningsCalendar?: Array<Record<string, unknown>> }
          const items = fhData.earningsCalendar ?? []
          filteredEntries = items
            .filter((it) => it.epsActual != null || it.revenueActual != null)
            .map((it) => ({
              ticker: String(it.symbol ?? '').toUpperCase(),
              company_name: String(it.symbol ?? ''),
              report_date: String(it.date ?? todayIso).slice(0, 10),
              report_time: String(it.hour ?? ''),
              quarter: it.quarter != null ? `Q${it.quarter}` : null,
              eps_actual: (it.epsActual as number | null) ?? null,
              eps_estimate: (it.epsEstimate as number | null) ?? null,
              revenue_actual: (it.revenueActual as number | null) ?? null,
              revenue_estimate: (it.revenueEstimate as number | null) ?? null,
            }))
            .filter((e) => !!e.ticker)
          sourceUsed = 'finnhub'
          console.log(`✅ Finnhub fallback: ${filteredEntries.length} entries with actuals`)
        } else {
          console.warn(`Finnhub fallback HTTP ${fhResp.status}: ${fhText.slice(0, 200)}`)
        }
      } catch (fhErr) {
        console.warn('Finnhub fallback failed:', fhErr instanceof Error ? fhErr.message : String(fhErr))
      }
    }

    if (filteredEntries.length === 0 && benzingaApiKey) {
      try {
        const bzUrl = new URL('https://api.benzinga.com/api/v2.1/calendar/earnings')
        bzUrl.searchParams.set('token', benzingaApiKey)
        bzUrl.searchParams.set('parameters[date]', todayIso)
        bzUrl.searchParams.set('pagesize', '1000')
        const bzResp = await fetch(bzUrl.toString(), { headers: { Accept: 'application/json' } })
        const bzText = await bzResp.text()
        if (bzResp.ok) {
          const bzData = JSON.parse(bzText) as { earnings?: Array<Record<string, unknown>> }
          const items = bzData.earnings ?? []
          filteredEntries = items
            .filter((it) => {
              const eps = String(it.eps ?? '').trim()
              const rev = String(it.revenue ?? '').trim()
              return eps !== '' || rev !== ''
            })
            .map((it) => ({
              ticker: String(it.ticker ?? '').toUpperCase(),
              company_name: String(it.name ?? it.ticker ?? ''),
              report_date: String(it.date ?? todayIso).slice(0, 10),
              report_time: String(it.time ?? ''),
              quarter: (it.period as string | null) ?? null,
              eps_actual: (it.eps as string | null) ?? null,
              eps_estimate: (it.eps_est as string | null) ?? null,
              revenue_actual: (it.revenue as string | null) ?? null,
              revenue_estimate: (it.revenue_est as string | null) ?? null,
            }))
            .filter((e) => !!e.ticker)
          sourceUsed = 'benzinga'
          console.log(`✅ Benzinga fallback: ${filteredEntries.length} entries with actuals`)
        } else {
          console.warn(`Benzinga fallback HTTP ${bzResp.status}: ${bzText.slice(0, 200)}`)
        }
      } catch (bzErr) {
        console.warn('Benzinga fallback failed:', bzErr instanceof Error ? bzErr.message : String(bzErr))
      }
    }

    if (filteredEntries.length === 0 && sourceUsed === 'none') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Parse unavailable (likely 402) and no Finnhub/Benzinga actuals for today',
          updated_count: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    console.log(`✅ Fetched ${filteredEntries.length} entries with actuals for today (source=${sourceUsed})`)

    if (filteredEntries.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No earnings entries with actuals found',
          updated_count: 0,
          source: sourceUsed,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('💾 Updating database with actual results...')
    let updatedCount = 0
    let errorCount = 0
    const confirmedForPurge: Array<{ ticker: string; code: string; reportDate: string }> = []

    for (const entry of filteredEntries) {
      try {
        const ticker = entry.ticker.toUpperCase()
        const code = `${ticker}.US`
        const reportDate = entry.report_date

        const epsActual = parseNumber(entry.eps_actual)
        const epsEstimate = parseNumber(entry.eps_estimate)
        const revenueActual = parseNumber(entry.revenue_actual)
        const revenueEstimate = parseNumber(entry.revenue_estimate)
        const beforeAfterMarket = parseReportTime(entry.report_time)

        let epsSurprise = null
        let epsSurprisePercent = null
        if (epsActual !== null && epsEstimate !== null && epsEstimate !== 0) {
          epsSurprise = epsActual - epsEstimate
          epsSurprisePercent = ((epsActual - epsEstimate) / Math.abs(epsEstimate)) * 100
        }

        let revenueSurprise = null
        let revenueSurprisePercent = null
        if (revenueActual !== null && revenueEstimate !== null && revenueEstimate !== 0) {
          revenueSurprise = revenueActual - revenueEstimate
          revenueSurprisePercent = ((revenueActual - revenueEstimate) / Math.abs(revenueEstimate)) * 100
        }

        const { data: existingRecords, error: searchError } = await supabase
          .from('earnings_calendar')
          .select('id, ticker, code, report_date, actual, revenue_actual')
          .eq('report_date', reportDate)
          .or(`ticker.eq.${ticker},code.eq.${code}`)
          .limit(1)

        if (searchError) {
          console.error(`❌ Error searching for ${code} (${reportDate}):`, searchError)
          errorCount++
        } else {

        const existing = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null

        if (existing) {
          const updateData: Record<string, unknown> = {}
          const prevActual = existing.actual == null ? null : Number(existing.actual)
          const prevRevenue = existing.revenue_actual == null ? null : Number(existing.revenue_actual)

          // רק שינוי אמיתי ב-actual — מפעיל את טריגר ה-push
          if (epsActual !== null && prevActual !== epsActual) {
            updateData.actual = epsActual
            if (epsEstimate !== null) {
              updateData.estimate = epsEstimate
            }
            if (epsSurprise !== null) {
              updateData.difference = epsSurprise
            }
            if (epsSurprisePercent !== null) {
              updateData.percent = epsSurprisePercent
            }
          }

          if (revenueActual !== null && prevRevenue !== revenueActual) {
            updateData.revenue_actual = revenueActual
            if (revenueEstimate !== null) {
              updateData.revenue_estimate_avg = revenueEstimate
              updateData.revenue_estimate = revenueEstimate
            }
            if (revenueSurprise !== null) {
              updateData.revenue_surprise = revenueSurprise
            }
            if (revenueSurprisePercent !== null) {
              updateData.revenue_surprise_percent = revenueSurprisePercent
            }
          }

          if (beforeAfterMarket) {
            updateData.before_after_market = beforeAfterMarket
          }
          if (entry.company_name) {
            updateData.company_name = entry.company_name
            updateData.asset_name = entry.company_name
          }
          if (entry.quarter) {
            updateData.quarter = entry.quarter
          }

          // אין שינוי EPS/Revenue — לא לכתוב (מונע רעש בלי push חדש)
          if (updateData.actual === undefined && updateData.revenue_actual === undefined) {
            // עדיין לנקות אומדנים ישנים ליד דיווח שכבר יש לו actual
            if (prevActual !== null || prevRevenue !== null) {
              confirmedForPurge.push({ ticker, code, reportDate })
            }
            continue
          }

          updateData.updated_at = new Date().toISOString()

          const { error: updateError } = await supabase
            .from('earnings_calendar')
            .update(updateData)
            .eq('id', existing.id)

          if (updateError) {
            console.error(`❌ Error updating ${code} (${reportDate}):`, updateError)
            errorCount++
          } else {
            console.log(`✅ Updated ${code} (${reportDate})`)
            updatedCount++
            confirmedForPurge.push({ ticker, code, reportDate })
          }
        } else {
          // נסיון שני: רשומת אומדן בתאריך קרוב (המקור שינה תאריך / תאריך מאושר אחר)
          const { data: nearbyRows, error: nearbyError } = await supabase
            .from('earnings_calendar')
            .select('id, ticker, code, report_date, actual, revenue_actual')
            .or(`ticker.eq.${ticker},code.eq.${code}`)
            .gte('report_date', addCalendarDays(reportDate, -7))
            .lte('report_date', addCalendarDays(reportDate, 7))
            .order('report_date', { ascending: true })
            .limit(5)

          if (nearbyError) {
            console.error(`❌ Nearby search for ${code}:`, nearbyError)
            errorCount++
          } else if (nearbyRows && nearbyRows.length > 0) {
            // העדף שורה בלי actual, אחרת הראשונה
            const target =
              nearbyRows.find((r) => r.actual == null && r.revenue_actual == null) ?? nearbyRows[0]
            console.log(
              `↩️ Remapping ${code} actual from API date ${reportDate} → DB ${target.report_date}`,
            )

            const remapData: Record<string, unknown> = {
              actual: epsActual,
              updated_at: new Date().toISOString(),
            }
            if (epsEstimate !== null) remapData.estimate = epsEstimate
            if (epsSurprise !== null) remapData.difference = epsSurprise
            if (epsSurprisePercent !== null) remapData.percent = epsSurprisePercent
            if (revenueActual !== null) remapData.revenue_actual = revenueActual
            if (revenueEstimate !== null) {
              remapData.revenue_estimate_avg = revenueEstimate
              remapData.revenue_estimate = revenueEstimate
            }
            if (revenueSurprise !== null) remapData.revenue_surprise = revenueSurprise
            if (revenueSurprisePercent !== null) {
              remapData.revenue_surprise_percent = revenueSurprisePercent
            }
            if (beforeAfterMarket) remapData.before_after_market = beforeAfterMarket
            if (entry.company_name) {
              remapData.company_name = entry.company_name
              remapData.asset_name = entry.company_name
            }
            if (entry.quarter) remapData.quarter = entry.quarter

            // אם תאריך ה-API שונה ואין התנגשות — הזז את report_date לתאריך האמיתי
            if (String(target.report_date) !== reportDate) {
              const { data: conflict } = await supabase
                .from('earnings_calendar')
                .select('id')
                .eq('ticker', ticker)
                .eq('report_date', reportDate)
                .maybeSingle()
              if (!conflict) {
                remapData.report_date = reportDate
                remapData.date = reportDate
              }
            }

            if (epsActual === null && revenueActual === null) {
              console.log(`⚠️ No actuals to write for nearby ${code} — skipping`)
            } else {
              const { error: remapError } = await supabase
                .from('earnings_calendar')
                .update(remapData)
                .eq('id', target.id)
              if (remapError) {
                console.error(`❌ Remap update ${code}:`, remapError)
                errorCount++
              } else {
                updatedCount++
                confirmedForPurge.push({
                  ticker,
                  code,
                  reportDate: String(remapData.report_date ?? target.report_date),
                })
              }
            }
          } else {
            console.log(`⚠️ No existing record found for ${code} (${reportDate}) - skipping`)
          }
        }
        }
      } catch (error) {
        console.error(`❌ Error processing entry ${entry.ticker}:`, error)
        errorCount++
      }
    }

    let staleDeleted = 0
    if (confirmedForPurge.length > 0) {
      const purge = await purgeStaleEstimateRowsNearConfirmed(supabase, confirmedForPurge)
      staleDeleted = purge.deleted
    }

    console.log(
      `✅ Update completed: ${updatedCount} updated, ${errorCount} errors, stale_deleted=${staleDeleted}`,
    )

    // אחרי כתיבת actual: sweep + flush מיידי (בנוסף לטריגר per-row) — מקרב לזמן האמת
    if (updatedCount > 0) {
      try {
        const notifyRes = await fetch(
          `${supabaseUrl}/functions/v1/earnings-results-notifications`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: '{}',
          },
        )
        if (!notifyRes.ok) {
          console.warn('⚠️ earnings-results-notifications sweep failed:', notifyRes.status)
        }
      } catch (e) {
        console.warn('⚠️ Failed to invoke earnings-results-notifications:', e)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Earnings results updated successfully',
        updated_count: updatedCount,
        error_count: errorCount,
        stale_estimate_deleted: staleDeleted,
        total_entries: filteredEntries.length,
        window: windowName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in update-earnings-results-live:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
