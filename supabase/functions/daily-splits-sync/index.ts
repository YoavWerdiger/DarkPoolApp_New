import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SplitData {
  code: string;
  name: string;
  exchange: string;
  date: string;
  ratio: string;
  numerator: number;
  denominator: number;
  is_reverse: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting Splits sync...')

    // יצירת Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // EODHD API Key
    const eodhdApiKey = Deno.env.get('EODHD_API_KEY')!
    if (!eodhdApiKey) {
      throw new Error('EODHD_API_KEY is required')
    }

    // חישוב טווח תאריכים - 3 חודשים אחורה + 6 חודשים קדימה
    const today = new Date()
    const startDate = new Date(today)
    startDate.setMonth(startDate.getMonth() - 3)
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 6) // פיצולים יכולים להיות מתוכננים רחוק יותר

    const fromDate = startDate.toISOString().split('T')[0]
    const toDate = endDate.toISOString().split('T')[0]

    console.log(`📅 Fetching splits from ${fromDate} to ${toDate}...`)

    // קריאה ל-EODHD API
    const apiUrl = `https://eodhd.com/api/calendar/splits?from=${fromDate}&to=${toDate}&api_token=${eodhdApiKey}&fmt=json`
    console.log('🔗 API URL:', apiUrl.replace(eodhdApiKey, '***'))

    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('✂️ Received splits data:', data)

    if (!data.splits || !Array.isArray(data.splits)) {
      throw new Error('Invalid response format from EODHD API')
    }

    let totalProcessed = 0
    let totalInserted = 0

    // עיבוד כל פיצול
    for (const split of data.splits) {
      totalProcessed++

      try {
        const splitData = {
          id: `split_${split.code}_${split.date}`,
          code: split.code,
          name: split.name || null,
          exchange: split.exchange || null,
          date: split.date,
          ratio: split.ratio,
          numerator: split.numerator,
          denominator: split.denominator,
          is_reverse: split.is_reverse,
          source: 'EODHD',
          updated_at: new Date().toISOString()
        }

        // הכנסה/עדכון במסד הנתונים
        const { error } = await supabase
          .from('splits_calendar')
          .upsert(splitData, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })

        if (error) {
          console.error('❌ Error upserting split:', error)
        } else {
          totalInserted++
        }

      } catch (error) {
        console.error('❌ Error processing split:', error)
      }
    }

    console.log(`✅ Splits sync completed: ${totalInserted}/${totalProcessed} records processed`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Splits synchronized successfully',
        processed: totalProcessed,
        inserted: totalInserted,
        dateRange: `${fromDate} to ${toDate}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Splits sync error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})