// Benzinga WebSocket Stream - Real-time Earnings Updates
// מתחבר ל-WebSocket stream של Benzinga ומעדכן את המסד נתונים בזמן אמת

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'
import { prepareEarningsRecord } from '../_shared/earnings-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting Benzinga WebSocket stream handler')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const benzingaApiKey = Deno.env.get('BENZINGA_API_KEY')
    if (!benzingaApiKey) {
      return new Response(JSON.stringify({ error: 'BENZINGA_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // פונקציה לניקוי ערכים - הסרת אפסים מיותרים
    const cleanNumericValue = (value: string | null | undefined): number | null => {
      if (!value || value === '' || value === '0' || value === '0.0' || value === '0.00' || value === '0.000' || value === '0.0000') {
        return null;
      }
      const num = parseFloat(value);
      if (isNaN(num)) return null;
      if (num === 0) return null;
      return num;
    };

    // פונקציה להמרת Benzinga earnings לפורמט EODHD
    const convertBenzingaToEODHDFormat = (earning: any) => {
      let before_after_market: string | null = null;
      if (earning.time) {
        const parts = earning.time.split(':');
        if (parts.length >= 2) {
          const hour = parseInt(parts[0]) || 0;
          const minutes = parseInt(parts[1]) || 0;
          const timeInMinutes = hour * 60 + minutes;
          
          // Before Market: 4:00-9:30 EST (240-570 דקות)
          if (timeInMinutes >= 240 && timeInMinutes < 570) {
            before_after_market = 'Before Market';
          }
          // After Market: 16:00-20:00 EST (960-1200 דקות)
          else if (timeInMinutes >= 960 && timeInMinutes < 1200) {
            before_after_market = 'After Market';
          }
        }
      }

      let actual: number | null = null;
      let estimate: number | null = null;
      let difference: number | null = null;
      let percent: number | null = null;

      // WebSocket מחזיר את התוצאות האקטואליות (actual) כשהן מתפרסמות
      // נשתמש ב-eps או revenue - מה שיש
      if (earning.eps && earning.eps !== '') {
        actual = cleanNumericValue(earning.eps);
        if (actual !== null) {
          if (earning.eps_est && earning.eps_est !== '') {
            estimate = cleanNumericValue(earning.eps_est);
            if (estimate !== null) {
              difference = actual - estimate;
              percent = estimate !== 0 ? (difference / Math.abs(estimate)) * 100 : 0;
            }
          }
        }
      } else if (earning.revenue && earning.revenue !== '') {
        actual = cleanNumericValue(earning.revenue);
        if (actual !== null) {
          if (earning.revenue_est && earning.revenue_est !== '') {
            estimate = cleanNumericValue(earning.revenue_est);
            if (estimate !== null) {
              difference = actual - estimate;
              percent = estimate !== 0 ? (difference / Math.abs(estimate)) * 100 : 0;
            }
          }
        }
      }

      const tickerCode = earning.ticker.includes('.') ? earning.ticker : `${earning.ticker}.US`;

      return {
        code: tickerCode,
        name: earning.name || earning.ticker,
        report_date: earning.date,
        date: earning.date,
        before_after_market,
        currency: earning.currency || 'USD',
        actual,
        estimate,
        difference,
        percent,
      };
    };

    // WebSocket URL עם token
    const wsUrl = `wss://api.benzinga.com/api/v2.1/calendar/earnings/stream?token=${benzingaApiKey}`
    
    console.log(`🔌 Connecting to Benzinga WebSocket: ${wsUrl.replace(benzingaApiKey, '***')}`)

    // יצירת WebSocket connection
    const ws = new WebSocket(wsUrl)
    
    let messageCount = 0
    let updateCount = 0
    let errorCount = 0
    const startTime = Date.now()

    ws.onopen = () => {
      console.log('✅ Connected to Benzinga WebSocket stream')
      console.log('📡 Listening for real-time earnings updates...')
    }

    ws.onmessage = async (event) => {
      try {
        messageCount++
        const data = JSON.parse(event.data)

        // בדיקה שהזאת הודעת נתונים (לא control message)
        if (data.kind === 'data/v2.1/calendar/earnings' && data.data) {
          const earningData = data.data.content
          const action = data.data.action // 'created', 'updated', 'deleted'

          console.log(`📨 Received ${action} event for ${earningData.ticker}`)

          // המרה לפורמט EODHD
          const convertedEarning = convertBenzingaToEODHDFormat(earningData)

          // הכנה ל-DB
          const prepared = prepareEarningsRecord(convertedEarning, {
            requireUSCode: true,
            skipPreferredShares: true,
            source: 'Benzinga'
          })

          if (!prepared) {
            console.log(`⚠️ Skipped ${earningData.ticker} - invalid record`)
            return
          }

          // עדכון/הוספה ל-DB רק עבור created/updated
          if (action === 'created' || action === 'updated') {
            const { error } = await supabase
              .from('earnings_calendar')
              .upsert(prepared.record, { 
                onConflict: 'id',
                ignoreDuplicates: false 
              })

            if (error) {
              console.error(`❌ Error upserting ${earningData.ticker}:`, error)
              errorCount++
            } else {
              updateCount++
              console.log(`✅ ${action === 'created' ? 'Created' : 'Updated'} ${earningData.ticker} - EPS: ${earningData.eps || 'N/A'}, Revenue: ${earningData.revenue || 'N/A'}`)
            }
          } else if (action === 'deleted') {
            // אפשרות למחוק את הרשומה אם צריך
            console.log(`🗑️ Deleted event for ${earningData.ticker} (not removing from DB)`)
          }
        } else if (data.kind === 'status' || data.type === 'ping') {
          // הודעות control - לא מעבדים
          console.log('💓 WebSocket ping/status message')
        }
      } catch (error) {
        console.error('❌ Error processing WebSocket message:', error)
        errorCount++
      }
    }

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error)
      errorCount++
    }

    ws.onclose = (event) => {
      const duration = Math.round((Date.now() - startTime) / 1000)
      console.log(`🔌 WebSocket closed after ${duration}s`)
      console.log(`📊 Stats: ${messageCount} messages, ${updateCount} updates, ${errorCount} errors`)
    }

    // החזרת response מיידי עם connection info
    // ה-WebSocket יעבוד ברקע
    return new Response(JSON.stringify({
      success: true,
      message: 'WebSocket stream started',
      websocket: {
        connected: true,
        url: wsUrl.replace(benzingaApiKey, '***')
      },
      note: 'This function maintains a persistent WebSocket connection. Check logs for updates.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('❌ WebSocket stream error:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})


