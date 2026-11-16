import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { isServiceCaller, serviceOnlyDenied } from '../_shared/serviceOnly.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // רק cron / שרת (מפתח service) — מפתח ה-anon של האפליקציה לא מספיק
  if (req.method !== 'OPTIONS' && !isServiceCaller(req)) return serviceOnlyDenied();
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Testing EODHD API...')

    // EODHD API Key
    const eodhdApiKey = Deno.env.get('EODHD_API_KEY') ?? ''
    
    // חישוב טווח תאריכים - רק היום
    const today = new Date()
    const fromDate = today.toISOString().split('T')[0]
    const toDate = fromDate

    console.log(`📅 Testing earnings API for ${fromDate}...`)

    // קריאה ל-EODHD API
    const apiUrl = `https://eodhd.com/api/calendar/earnings?from=${fromDate}&to=${toDate}&api_token=${eodhdApiKey}&fmt=json`
    console.log('🔗 API URL:', apiUrl.replace(eodhdApiKey, '***'))

    const response = await fetch(apiUrl)
    console.log('📡 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API Error:', errorText)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `EODHD API error: ${response.status} ${response.statusText}`,
          details: errorText
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const data = await response.json()
    console.log('📈 Received data structure:', Object.keys(data))
    console.log('📊 Earnings count:', data.earnings ? data.earnings.length : 'No earnings array')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'EODHD API test successful',
        data: {
          type: data.type,
          description: data.description,
          from: data.from,
          to: data.to,
          earningsCount: data.earnings ? data.earnings.length : 0,
          sampleEarnings: data.earnings ? data.earnings.slice(0, 3) : []
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Test error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
