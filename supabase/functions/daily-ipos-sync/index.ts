import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface IPOData {
  code: string;
  name: string;
  exchange: string;
  currency: string;
  start_date: string;
  filing_date: string;
  amended_date: string;
  price_from: number;
  price_to: number;
  offer_price: number;
  shares: number;
  deal_type: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting IPOs sync...')

    // יצירת Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // EODHD API Key
    const eodhdApiKey = Deno.env.get('EODHD_API_KEY')!
    if (!eodhdApiKey) {
      throw new Error('EODHD_API_KEY is required')
    }

    // חישוב טווח תאריכים - 3 חודשים אחורה + 3 חודשים קדימה
    const today = new Date()
    const startDate = new Date(today)
    startDate.setMonth(startDate.getMonth() - 3)
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 3)

    const fromDate = startDate.toISOString().split('T')[0]
    const toDate = endDate.toISOString().split('T')[0]

    console.log(`📅 Fetching IPOs from ${fromDate} to ${toDate}...`)

    // קריאה ל-EODHD API
    const apiUrl = `https://eodhd.com/api/calendar/ipos?from=${fromDate}&to=${toDate}&api_token=${eodhdApiKey}&fmt=json`
    console.log('🔗 API URL:', apiUrl.replace(eodhdApiKey, '***'))

    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('🚀 Received IPOs data:', data)

    if (!data.ipos || !Array.isArray(data.ipos)) {
      throw new Error('Invalid response format from EODHD API')
    }

    let totalProcessed = 0
    let totalInserted = 0

    // עיבוד כל IPO
    for (const ipo of data.ipos) {
      totalProcessed++

      try {
        const ipoData = {
          id: `ipo_${ipo.code}_${ipo.start_date || ipo.filing_date}`,
          code: ipo.code,
          name: ipo.name || null,
          exchange: ipo.exchange || null,
          currency: ipo.currency || null,
          start_date: ipo.start_date || null,
          filing_date: ipo.filing_date || null,
          amended_date: ipo.amended_date || null,
          price_from: ipo.price_from || 0,
          price_to: ipo.price_to || 0,
          offer_price: ipo.offer_price || 0,
          shares: ipo.shares || 0,
          deal_type: ipo.deal_type || 'Unknown',
          source: 'EODHD',
          updated_at: new Date().toISOString()
        }

        // הכנסה/עדכון במסד הנתונים
        const { error } = await supabase
          .from('ipos_calendar')
          .upsert(ipoData, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })

        if (error) {
          console.error('❌ Error upserting IPO:', error)
        } else {
          totalInserted++
        }

      } catch (error) {
        console.error('❌ Error processing IPO:', error)
      }
    }

    console.log(`✅ IPOs sync completed: ${totalInserted}/${totalProcessed} records processed`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'IPOs synchronized successfully',
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
    console.error('❌ IPOs sync error:', error)

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