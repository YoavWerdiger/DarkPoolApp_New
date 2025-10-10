// Daily Earnings Sync - Edge Function
// שולף נתוני Earnings מ-EODHD API ומעדכן את Supabase DB

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EODHD_API_KEY = '68e3c3af900997.85677801'
const EODHD_BASE_URL = 'https://eodhd.com/api'

interface EarningsEvent {
  id: string
  title: string
  company: string
  symbol: string
  report_date: string
  date: string
  before_after_market?: string
  currency?: string
  actual?: number
  estimate?: number
  difference?: number
  percent?: number
  source: string
  createdAt: string
  dateObject: Date
}

serve(async (req) => {
  try {
    console.log('🚀 Daily Earnings Sync started')
    
    // יצירת Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // קבלת תאריכים - שבוע אחד קדימה (מצומצם יותר)
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 1) // יום אחד אחורה
    
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 7) // שבוע אחד קדימה (במקום 14)
    
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]
    
    console.log(`📅 Fetching earnings from ${startDateStr} to ${endDateStr}`)
    
    // שליפת Earnings מ-EODHD
    const earnings = await fetchEODHDEarnings(startDateStr, endDateStr)
    
    console.log(`📊 Fetched ${earnings.length} earnings events from EODHD`)
    
    // שמירה ב-Supabase
    if (earnings.length > 0) {
      // מחיקת נתונים ישנים
      const { error: deleteError } = await supabase
        .from('earnings_events')
        .delete()
        .gte('report_date', startDateStr)
        .lte('report_date', endDateStr)
      
      if (deleteError) {
        console.log('❌ Error deleting old earnings:', deleteError)
      }
      
      // הוספת נתונים חדשים
      const { error: insertError } = await supabase
        .from('earnings_events')
        .insert(earnings)
      
      if (insertError) {
        console.log('❌ Error inserting new earnings:', insertError)
      } else {
        console.log(`✅ Successfully saved ${earnings.length} earnings to database`)
      }
    }
    
    // שליחת התראות Push ל-earnings חשובים היום
    const todayStr = today.toISOString().split('T')[0]
    const todayEarnings = earnings.filter(earning => 
      earning.report_date === todayStr && 
      ['JPM.US', 'WFC.US', 'BAC.US', 'GS.US', 'MS.US', 'BLK.US'].includes(earning.symbol)
    )
    
    if (todayEarnings.length > 0) {
      console.log(`📱 Found ${todayEarnings.length} important earnings today`)
      
      // כאן נוכל להוסיף שליחת Push Notifications
      // TODO: Implement push notifications for earnings
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: `Successfully synced ${earnings.length} earnings events`,
      earningsCount: earnings.length,
      todayImportantEarnings: todayEarnings.length
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })
    
  } catch (error) {
    console.error('❌ Daily Earnings Sync error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

// פונקציה לשליפת Earnings מ-EODHD
async function fetchEODHDEarnings(startDate: string, endDate: string): Promise<EarningsEvent[]> {
  try {
    const url = `${EODHD_BASE_URL}/calendar/earnings?api_token=${EODHD_API_KEY}&from=${startDate}&to=${endDate}&fmt=json`
    
    console.log(`📡 EODHD Earnings API: ${url}`)
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.log(`❌ EODHD Earnings API error: HTTP ${response.status}`)
      return []
    }
    
    const data = await response.json()
    const earnings: EarningsEvent[] = []
    
    if (data && data.earnings && Array.isArray(data.earnings)) {
      data.earnings.forEach((earning: any) => {
        // מיפוי נתונים מ-EODHD לפורמט שלנו
        const reportDate = new Date(earning.report_date)
        
        earnings.push({
          id: `earnings_${earning.code}_${earning.report_date}`,
          title: `📊 Earnings Report - ${getCompanyName(earning.code)}`,
          company: getCompanyName(earning.code),
          symbol: earning.code,
          report_date: earning.report_date,
          date: earning.date,
          before_after_market: earning.before_after_market,
          currency: earning.currency,
          actual: earning.actual,
          estimate: earning.estimate,
          difference: earning.difference,
          percent: earning.percent,
          source: 'EODHD Earnings Calendar',
          createdAt: new Date().toISOString(),
          dateObject: reportDate
        })
      })
    }
    
    return earnings
    
  } catch (error) {
    console.log('❌ EODHD Earnings fetch error:', error)
    return []
  }
}

// פונקציה לקבלת שם החברה מהסמל
function getCompanyName(symbol: string): string {
  const companyNames: { [key: string]: string } = {
    'JPM.US': 'JPMorgan Chase',
    'WFC.US': 'Wells Fargo',
    'BAC.US': 'Bank of America',
    'GS.US': 'Goldman Sachs',
    'MS.US': 'Morgan Stanley',
    'BLK.US': 'BlackRock',
    'C.US': 'Citigroup',
    'PNC.US': 'PNC Financial',
    'MTB.US': 'M&T Bank',
    'UNH.US': 'UnitedHealth',
    'INFY.US': 'Infosys',
    'TSM.US': 'Taiwan Semiconductor',
    'PAYTM.BSE': 'Paytm',
    'RELIANCE.BSE': 'Reliance Industries',
    'AXISBANK.BSE': 'Axis Bank',
    'KOTAKBANK.BSE': 'Kotak Mahindra Bank'
  }
  
  return companyNames[symbol] || symbol.replace(/\.(US|BSE|NSE)$/, '')
}

