import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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
    console.log('🚀 Starting Earnings sync...')

    // יצירת Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing Supabase configuration'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Benzinga API Key
    const benzingaApiKey = Deno.env.get('BENZINGA_API_KEY') || 'bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC'
    
    // Helper function to get date in America/New_York timezone (EST/EDT)
    // Benzinga API expects dates in US Eastern time
    const getDateInEST = (date: Date): string => {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      return formatter.format(date)
    }
    
    // קריאת פרמטרים מ-body (אם יש)
    let fromDate: string
    let toDate: string
    
    try {
      const body = await req.json().catch(() => ({}))
      
      if (body.date_from && body.date_to) {
        // שימוש בפרמטרים מה-body (מניחים שהם כבר בפורמט YYYY-MM-DD)
        fromDate = body.date_from
        toDate = body.date_to
        console.log(`📅 Using custom date range from body: ${fromDate} to ${toDate}`)
      } else {
        // חישוב טווח תאריכים - 3 חודשים אחורה + שנה קדימה (מקסימום)
        // חשוב: משתמשים ב-America/New_York timezone כי Benzinga מצפה לתאריכים ב-EST/EDT
        const now = new Date()
        const startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 3) // 3 חודשים אחורה
        const endDate = new Date(now)
        endDate.setFullYear(endDate.getFullYear() + 1) // שנה קדימה

        fromDate = getDateInEST(startDate)
        toDate = getDateInEST(endDate)
        console.log(`📅 Using default date range (EST/EDT): ${fromDate} to ${toDate} (MAXIMUM RANGE)`)
      }
    } catch (error) {
      // אם אין body או שגיאה, נשתמש בערכי ברירת מחדל
      const now = new Date()
      const startDate = new Date(now)
      startDate.setMonth(startDate.getMonth() - 3) // 3 חודשים אחורה
      const endDate = new Date(now)
      endDate.setFullYear(endDate.getFullYear() + 1) // שנה קדימה

      fromDate = getDateInEST(startDate)
      toDate = getDateInEST(endDate)
      console.log(`📅 Using default date range (fallback, EST/EDT): ${fromDate} to ${toDate} (MAXIMUM RANGE)`)
    }

    // בדיקת פורמט תאריכים - חייב להיות YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid date format. Must be YYYY-MM-DD',
          fromDate,
          toDate
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // חישוב טווח ימים - אם התאריכים זהים, זה יום אחד (לא 0)
    const fromDateObj = new Date(fromDate)
    const toDateObj = new Date(toDate)
    const daysRange = Math.max(1, Math.ceil((toDateObj.getTime() - fromDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    console.log(`📅 Fetching earnings calendar from ${fromDate} to ${toDate}...`)
    console.log(`📅 Date range: ${daysRange} days`)
    console.log(`📅 Goal: ALL earnings events for ALL companies in this date range`)
    console.log(`📅 Strategy: Fetching day-by-day to ensure we get ALL earnings (Benzinga limitation workaround)`)
    
    // שליפה יום-יום - זה עוזר לעקוף את המגבלה של Benzinga
    // שמחזיר רק 3 דיווחים קרובים לכל מניה בטווח גדול
    const allEarnings: any[] = []
    const processedDates = new Set<string>() // למניעת כפילויות
    
    // לולאה על כל יום בטווח
    const currentDate = new Date(fromDateObj)
    const endDate = new Date(toDateObj)
    let dayIndex = 0
    
    while (currentDate <= endDate) {
      const currentDateStr = getDateInEST(currentDate)
      dayIndex++
      
      console.log(`📅 Fetching day ${dayIndex}/${daysRange}: ${currentDateStr}...`)
      
      // שליפה יום-יום עם pagination - זה עוזר לעקוף את המגבלה של Benzinga
      let currentPage = 0
      const pageSize = 1000 // גודל דף סביר
      const MAX_PAGES_PER_DAY = 10 // מקסימום דפים ליום (10 * 1000 = 10,000 דיווחים ליום)
      let hasMore = true
      let consecutiveEmptyPages = 0
      let dayEarnings = 0
      
      while (hasMore) {
        console.log(`📄 Fetching page ${currentPage} for date ${currentDateStr}...`)
        
        // קריאה ל-Benziga API עם pagination - יום בודד
        // שימוש ב-parameters[date] במקום date_from/date_to כדי לקבל את כל הדיווחים של היום
        const apiUrl = new URL('https://api.benzinga.com/api/v2/calendar/earnings')
        apiUrl.searchParams.append('token', benzingaApiKey)
        apiUrl.searchParams.append('accept', 'application/json')
        apiUrl.searchParams.append('parameters[date]', currentDateStr) // יום בודד - זה עוזר לקבל את כל הדיווחים!
      // לא שולחים parameters[importance] - רוצים את כל הדיווחים, לא רק חשיבות גבוהה!
      // לא שולחים parameters[exchange] - רוצים את כל הבורסות (US Equities)
      // לא שולחים parameters[tickers] - רוצים את כל המניות
      apiUrl.searchParams.append('page', currentPage.toString()) // דף (0-100000)
      apiUrl.searchParams.append('pagesize', pageSize.toString()) // גודל דף (ניסיון עם 10000)
      
      // לוג חשוב: וידוא שלא שולחים parameters[tickers] - זה יגביל רק למניות מסוימות!
      console.log(`🔍 API Parameters:`)
      console.log(`   ├─ date: ${currentDateStr} (single day - using parameters[date])`)
      console.log(`   ├─ importance: NONE (fetching ALL importance levels)`)
      console.log(`   ├─ page: ${currentPage}`)
      console.log(`   └─ pagesize: ${pageSize}`)
      console.log(`🔍 NOT sending parameters[tickers], parameters[exchange], or parameters[importance] - fetching ALL companies on ${currentDateStr}`)
        
        // לוג URL לבדיקה (ללא token)
        console.log(`📡 API URL: ${apiUrl.toString().replace(benzingaApiKey, '***')}`)
        
        const response = await fetch(apiUrl.toString(), {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })
        
        console.log(`📡 Response status: ${response.status} ${response.statusText}`)
        console.log(`📡 Content-Type: ${response.headers.get('content-type')}`)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ API Error Response: ${errorText.substring(0, 500)}`)
          
          return new Response(
            JSON.stringify({
              success: false,
              error: `Benzinga API error: ${response.status} ${response.statusText}`,
              details: errorText.substring(0, 200)
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500,
            }
          )
        }

        // בדיקה ופרסור התגובה
        const contentType = response.headers.get('content-type') || ''
        let data: any
        
        if (contentType.includes('application/json')) {
          // JSON response
          try {
            const responseText = await response.text()
            console.log(`📄 Page ${currentPage} response preview (first 500 chars): ${responseText.substring(0, 500)}`)
            
            const parsed = JSON.parse(responseText)
            
            // Benzinga יכול להחזיר:
            // 1. {"earnings": [...]} - אובייקט עם שדה earnings
            // 2. [] - מערך ישיר (ריק או לא)
            if (Array.isArray(parsed)) {
              // תגובה היא מערך ישיר
              if (parsed.length === 0) {
                console.log(`📄 Page ${currentPage}: Empty array response (no earnings)`)
                consecutiveEmptyPages++
                if (consecutiveEmptyPages >= 2) {
                  hasMore = false
                  console.log(`📄 Reached last page (got ${consecutiveEmptyPages} consecutive empty pages)`)
                } else {
                  currentPage++
                }
                continue
              }
              // אם יש תוכן במערך, נניח שזה earnings
              console.log(`✅ Page ${currentPage}: Found ${parsed.length} earnings (array response)`)
              consecutiveEmptyPages = 0
              data = { earnings: parsed }
            } else if (parsed && typeof parsed === 'object') {
              // תגובה היא אובייקט
              if (!parsed.earnings) {
                console.log(`📄 Page ${currentPage}: No 'earnings' field in response (empty page)`)
                hasMore = false
                break
              }
              
              if (!Array.isArray(parsed.earnings)) {
                console.log(`⚠️ Page ${currentPage}: 'earnings' is not an array:`, typeof parsed.earnings)
                hasMore = false
                break
              }
              
              // אם המערך ריק, זה תקין - אין עוד דיווחים
              if (parsed.earnings.length === 0) {
                console.log(`📄 Page ${currentPage}: Empty earnings array (no more pages)`)
                consecutiveEmptyPages++
                if (consecutiveEmptyPages >= 2) {
                  hasMore = false
                  console.log(`📄 Reached last page (got ${consecutiveEmptyPages} consecutive empty pages)`)
                } else {
                  currentPage++
                }
                continue
              }
              
              // איפוס מונה הדפים הריקים כי מצאנו נתונים
              consecutiveEmptyPages = 0
              console.log(`✅ Page ${currentPage}: Found ${parsed.earnings.length} earnings`)
              data = parsed
            } else {
              console.log(`⚠️ Invalid JSON response structure:`, typeof parsed, parsed)
              hasMore = false
              break
            }
          } catch (parseError) {
            console.error(`❌ Failed to parse JSON on page ${currentPage}:`, parseError)
            hasMore = false
            break
          }
        } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
          // XML response - ננסה לפרסר XML ידנית
          const xmlText = await response.text()
          console.log(`⚠️ Received XML instead of JSON for earnings, attempting to parse XML...`)
          console.log(`📄 XML preview: ${xmlText.substring(0, 500)}`)
          
          try {
            // ננסה לפרסר XML פשוט - חיפוש אחר <item> או <earnings>
            const items: any[] = []
            const itemRegex = /<item>(.*?)<\/item>/gs
            const matches = xmlText.matchAll(itemRegex)
            
            for (const match of matches) {
              const itemXml = match[1]
              const item: any = {}
              
              // חילוץ שדות בסיסיים
              const idMatch = itemXml.match(/<id>(.*?)<\/id>/)
              const dateMatch = itemXml.match(/<date>(.*?)<\/date>/)
              const timeMatch = itemXml.match(/<time>(.*?)<\/time>/)
              const tickerMatch = itemXml.match(/<ticker>(.*?)<\/ticker>/)
              const nameMatch = itemXml.match(/<name>(.*?)<\/name>/)
              const epsMatch = itemXml.match(/<eps>(.*?)<\/eps>/)
              const epsEstMatch = itemXml.match(/<eps_est>(.*?)<\/eps_est>/)
              const revenueMatch = itemXml.match(/<revenue>(.*?)<\/revenue>/)
              const revenueEstMatch = itemXml.match(/<revenue_est>(.*?)<\/revenue_est>/)
              const currencyMatch = itemXml.match(/<currency>(.*?)<\/currency>/)
              
              if (idMatch) item.id = idMatch[1]
              if (dateMatch) item.date = dateMatch[1]
              if (timeMatch) item.time = timeMatch[1]
              if (tickerMatch) item.ticker = tickerMatch[1]
              if (nameMatch) item.name = nameMatch[1]
              if (epsMatch) item.eps = epsMatch[1]
              if (epsEstMatch) item.eps_est = epsEstMatch[1]
              if (revenueMatch) item.revenue = revenueMatch[1]
              if (revenueEstMatch) item.revenue_est = revenueEstMatch[1]
              if (currencyMatch) item.currency = currencyMatch[1]
              
              if (item.id && item.date) {
                items.push(item)
              }
            }
            
            if (items.length > 0) {
              console.log(`✅ Parsed ${items.length} earnings from XML`)
              data = { earnings: items }
            } else {
              throw new Error('No items found in XML')
            }
          } catch (parseError) {
            console.error(`❌ Failed to parse XML:`, parseError)
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Benzinga API returned XML but failed to parse',
                details: 'The API endpoint may require a different format parameter',
                xmlPreview: xmlText.substring(0, 500)
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
              }
            )
          }
        } else {
          // Unknown format
          const responseText = await response.text()
          console.error(`❌ Unexpected content type: ${contentType}`)
          console.error(`❌ Response: ${responseText.substring(0, 500)}`)
          
          return new Response(
            JSON.stringify({
              success: false,
              error: `Unexpected response type: ${contentType}`,
              response: responseText.substring(0, 200)
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500,
            }
          )
        }

        // הוספת earnings מהדף הנוכחי
        // בשלב זה כבר בדקנו ש-data.earnings הוא מערך תקין
        if (data.earnings && Array.isArray(data.earnings)) {
          if (data.earnings.length === 0) {
            // אין רשומות - זה דף ריק
            consecutiveEmptyPages++
            console.log(`📄 Page ${currentPage}: Empty (consecutive empty pages: ${consecutiveEmptyPages})`)
            
            // אם קיבלנו 2 דפים ריקים רצופים, נעצור
            // (זה אומר שאין עוד דיווחים)
            if (consecutiveEmptyPages >= 2) {
              hasMore = false
              console.log(`📄 Reached last page (got ${consecutiveEmptyPages} consecutive empty pages)`)
            } else {
              // ננסה עוד דף אחד
              currentPage++
              if (currentPage >= MAX_PAGES) {
                hasMore = false
                console.log(`⚠️ Reached maximum pages`)
              }
            }
          } else {
            // יש רשומות - איפוס מונה הדפים הריקים
            consecutiveEmptyPages = 0
            
            // 🔥 NO FILTERING - שומרים את כל מה שה-API מחזיר
            // הסינון יבוצע באפליקציה לפי יום
            allEarnings.push(...data.earnings)
            console.log(`✅ Page ${currentPage}: Received ${data.earnings.length} earnings (NO FILTERING - saving all) (Total: ${allEarnings.length})`)
            
            // בדיקה אם יש עוד דפים
            // נמשיך לשלוף דפים כל עוד:
            // 1. קיבלנו בדיוק pageSize רשומות (כנראה יש עוד דפים)
            // 2. קיבלנו פחות מ-pageSize אבל עדיין לא קיבלנו 2 דפים ריקים רצופים
            
            if (data.earnings.length === pageSize) {
              // קיבלנו בדיוק pageSize - כנראה יש עוד דפים
              currentPage++
              dayEarnings += data.earnings.length
              if (currentPage >= MAX_PAGES_PER_DAY) {
                hasMore = false
                console.log(`⚠️ Reached maximum pages for day ${currentDateStr} (${MAX_PAGES_PER_DAY} pages)`)
              } else {
                console.log(`📄 Continuing to next page for ${currentDateStr} (got ${data.earnings.length} = ${pageSize}, likely more pages)`)
              }
            } else {
              // קיבלנו פחות מ-pageSize
              // זה יכול להיות הדף האחרון, אבל נבדוק עוד דף אחד כדי לוודא
              console.log(`📄 Got ${data.earnings.length} < ${pageSize} for ${currentDateStr}, checking next page to confirm...`)
              dayEarnings += data.earnings.length
              currentPage++
              
              if (currentPage >= MAX_PAGES_PER_DAY) {
                hasMore = false
                console.log(`⚠️ Reached maximum pages for day ${currentDateStr} before checking next page`)
              } else {
                console.log(`📄 Will check page ${currentPage} for ${currentDateStr} to confirm if there are more earnings...`)
              }
              // נמשיך בלולאה לבדוק את הדף הבא
              // אם הדף הבא ריק (length === 0), נעצור אחרי 2 דפים ריקים רצופים
            }
          }
        }
      } // סוף while hasMore (pagination ליום)
      
      console.log(`✅ Day ${currentDateStr} completed:`)
      console.log(`   ├─ Day earnings: ${dayEarnings}`)
      console.log(`   └─ Total unique so far: ${allEarnings.length}`)
      
      // מעבר ליום הבא
      currentDate.setDate(currentDate.getDate() + 1)
    } // סוף לולאת הימים
    
    // הסרת כפילויות
    const uniqueEarnings: any[] = []
    for (const earning of allEarnings) {
      const ticker = earning.ticker || earning.code || 'UNKNOWN'
      const date = earning.date || earning.report_date || 'UNKNOWN'
      const earningKey = `${ticker}_${date}`
      
      if (!processedDates.has(earningKey)) {
        uniqueEarnings.push(earning)
        processedDates.add(earningKey)
      }
    }
    
    console.log(`✅ Bulk fetch completed:`)
    console.log(`   ├─ Total fetched: ${allEarnings.length}`)
    console.log(`   ├─ Unique: ${uniqueEarnings.length}`)
    console.log(`   └─ Duplicates removed: ${allEarnings.length - uniqueEarnings.length}`)
    
    // החלפת allEarnings ב-uniqueEarnings
    allEarnings.length = 0
    allEarnings.push(...uniqueEarnings)
    
    const totalFetched = allEarnings.length
    console.log(`📈 Total earnings fetched: ${totalFetched} from ${daysRange} days`)
    console.log(`📊 Date range: ${fromDate} to ${toDate} (${daysRange} days)`)
    
    if (allEarnings.length > 0) {
      const uniqueTickers = new Set(allEarnings.map((e: any) => e.ticker || e.code))
      const dateDistribution = Object.entries(
        allEarnings.reduce((acc: any, e: any) => {
          const date = e.date || e.report_date
          acc[date] = (acc[date] || 0) + 1
          return acc
        }, {})
      ).sort((a, b) => a[0].localeCompare(b[0]))
      
      console.log(`📊 Summary:`)
      console.log(`   ├─ Total earnings: ${totalFetched}`)
      console.log(`   ├─ Unique companies: ${uniqueTickers.size}`)
      console.log(`   ├─ Pages fetched: ${currentPage + 1}`)
      console.log(`   ├─ First earnings date: ${allEarnings[0]?.date || 'N/A'}`)
      console.log(`   └─ Last earnings date: ${allEarnings[allEarnings.length - 1]?.date || 'N/A'}`)
      
      console.log(`📊 Date distribution (first 10 dates):`)
      dateDistribution.slice(0, 10).forEach(([date, count]) => {
        console.log(`   ├─ ${date}: ${count} earnings`)
      })
      
      // בדיקה: האם יש רק 3 דיווחים לכל מניה?
      const tickerCounts = Array.from(uniqueTickers).map(ticker => {
        const count = allEarnings.filter((e: any) => (e.ticker || e.code) === ticker).length
        return { ticker, count }
      }).sort((a, b) => b.count - a.count)
      
      const avgReportsPerTicker = totalFetched / uniqueTickers.size
      console.log(`📊 Reports per company:`)
      console.log(`   ├─ Average: ${avgReportsPerTicker.toFixed(2)} reports per company`)
      console.log(`   ├─ Max: ${tickerCounts[0]?.count || 0} reports (${tickerCounts[0]?.ticker || 'N/A'})`)
      console.log(`   └─ Min: ${tickerCounts[tickerCounts.length - 1]?.count || 0} reports`)
      
      if (avgReportsPerTicker <= 3.5) {
        console.log(`⚠️ WARNING: Average reports per company is ${avgReportsPerTicker.toFixed(2)}`)
        console.log(`⚠️ This suggests Benzinga API might be limiting results to ~3 reports per company`)
        console.log(`⚠️ Check if pagination is working correctly or if API has a limit`)
      }
    } else {
      console.log(`⚠️ WARNING: No earnings fetched!`)
      console.log(`⚠️ Check: date range, API key, API response format`)
    }

    if (!allEarnings || allEarnings.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No earnings found in the specified date range',
          dateRange: `${fromDate} to ${toDate}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // 200 כי זה לא שגיאה - פשוט אין נתונים
        }
      )
    }

    // פונקציה לניקוי ערכים - הסרת אפסים מיותרים
    const cleanNumericValue = (value: string | null | undefined): number | null => {
      if (!value || value === '' || value === '0' || value === '0.0' || value === '0.00' || value === '0.000' || value === '0.0000') {
        return null;
      }
      const num = parseFloat(value);
      if (isNaN(num)) return null;
      // אם זה 0, החזר null
      if (num === 0) return null;
      return num;
    };

    // 🔥 NO FILTERING - שומרים את כל מה שה-API מחזיר
    // הסינון יבוצע באפליקציה לפי יום, exchange, וכו'
    console.log(`📊 Total earnings fetched: ${allEarnings.length} (NO FILTERING - saving all)`)
    
    // לוג למעקב - כמה earnings יש בכלל
    if (allEarnings.length === 0) {
      console.log(`⚠️ WARNING: No earnings fetched from Benzinga API!`)
      console.log(`⚠️ Check: date range, API key, API response format`)
    }

    // המרת Benzinga earnings לפורמט EODHD (תואם ל-earnings-utils)
    const convertedEarnings = allEarnings.map((earning: any) => {
      // Benzinga API לא מחזיר before_after_market - אנחנו קובעים לפי השעה
      // השעה ב-Benzinga היא ב-EST (Eastern Time)
      // Before Market: 4:00-9:30 EST (פתיחת השוק ב-9:30 EST)
      // After Market: 16:00-20:00 EST (סגירת השוק ב-16:00 EST)
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
          // אם השעה היא 0:00 או לא בטווח, נשאיר null
        }
      }

      // EPS fields
      let actual: number | null = null;
      let estimate: number | null = null;
      let difference: number | null = null;
      let percent: number | null = null;

      // עיבוד EPS
      // Benzinga API מחזיר: eps, eps_est, eps_prior, eps_surprise, eps_surprise_percent
      // אם יש surprise values, נשתמש בהם; אחרת נחשב בעצמנו
      if (earning.eps && earning.eps !== '') {
        actual = cleanNumericValue(earning.eps);
        if (actual !== null) {
          if (earning.eps_est && earning.eps_est !== '') {
            estimate = cleanNumericValue(earning.eps_est);
            if (estimate !== null) {
              // אם יש surprise values מ-Benzinga, נשתמש בהם
              if (earning.eps_surprise && earning.eps_surprise !== '') {
                difference = cleanNumericValue(earning.eps_surprise);
              } else {
                // אחרת נחשב בעצמנו
              difference = actual - estimate;
                difference = Math.round(difference * 10000) / 10000;
              }
              
              if (earning.eps_surprise_percent && earning.eps_surprise_percent !== '') {
                percent = cleanNumericValue(earning.eps_surprise_percent);
              } else {
                // אחרת נחשב בעצמנו
                percent = estimate !== 0 ? (difference! / Math.abs(estimate)) * 100 : 0;
                percent = Math.round(percent * 100) / 100;
              }
            }
          }
        }
      }

      // Revenue fields - חשוב: שומרים גם אם יש EPS!
      // Benzinga API מחזיר: revenue, revenue_est, revenue_prior, revenue_surprise, revenue_surprise_percent
      const revenue_actual = cleanNumericValue(earning.revenue);
      const revenue_estimate_avg = cleanNumericValue(earning.revenue_est);
      
      // אם יש surprise values מ-Benzinga, נשתמש בהם
      let revenue_surprise: number | null = null;
      let revenue_surprise_percent: number | null = null;
      if (revenue_actual !== null && revenue_estimate_avg !== null) {
        if (earning.revenue_surprise && earning.revenue_surprise !== '') {
          revenue_surprise = cleanNumericValue(earning.revenue_surprise);
        } else {
          // אחרת נחשב בעצמנו
          revenue_surprise = revenue_actual - revenue_estimate_avg;
          revenue_surprise = Math.round(revenue_surprise * 10000) / 10000;
        }
        
        if (earning.revenue_surprise_percent && earning.revenue_surprise_percent !== '') {
          revenue_surprise_percent = cleanNumericValue(earning.revenue_surprise_percent);
        } else {
          // אחרת נחשב בעצמנו
          revenue_surprise_percent = revenue_estimate_avg !== 0 ? (revenue_surprise! / Math.abs(revenue_estimate_avg)) * 100 : 0;
          revenue_surprise_percent = Math.round(revenue_surprise_percent * 100) / 100;
        }
      }

      // חישוב revenue YoY אם יש revenue_prior
      let revenue_yoy: number | null = null;
      if (revenue_actual !== null && earning.revenue_prior && earning.revenue_prior !== '') {
        const revenue_prior = cleanNumericValue(earning.revenue_prior);
        if (revenue_prior !== null && revenue_prior !== 0) {
          revenue_yoy = ((revenue_actual - revenue_prior) / Math.abs(revenue_prior)) * 100;
          revenue_yoy = Math.round(revenue_yoy * 100) / 100;
        }
      }

      // וידוא שיש ticker - אם אין, נשתמש ב-code
      const ticker = earning.ticker || earning.code || 'UNKNOWN';
      const tickerCode = ticker.includes('.') ? ticker : `${ticker}.US`;
      
      // וידוא שיש תאריך - אם אין, נשתמש ב-fromDate (תאריך התחלה)
      // חשוב: date הוא בפורמט YYYY-MM-DD (או YYYY-DD-MM לפי התיעוד, אבל נבדוק בפועל)
      let earningDate = earning.date || earning.report_date || fromDate;
      
      // נרמול תאריך - אם הוא בפורמט YYYY-DD-MM, נמיר ל-YYYY-MM-DD
      if (earningDate && earningDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // בדיקה אם זה בפורמט YYYY-DD-MM (יום > 12)
        const parts = earningDate.split('-');
        if (parts.length === 3) {
          const year = parts[0];
          const month = parts[1];
          const day = parts[2];
          // אם החודש > 12, זה כנראה YYYY-DD-MM
          if (parseInt(month) > 12 && parseInt(day) <= 12) {
            earningDate = `${year}-${day}-${month}`; // החלפה
          }
        }
      }
      
      // date_confirmed הוא בוליאני כמחרוזת ("1" או "0"), לא תאריך!
      // נמיר אותו ל-boolean ואז נשמור את התאריך רק אם הוא true
      let dateConfirmedStr: string | null = null;
      if (earning.date_confirmed !== null && earning.date_confirmed !== undefined) {
        const confirmedStr = String(earning.date_confirmed).trim();
        const isConfirmed = confirmedStr === '1' || confirmedStr.toLowerCase() === 'true';
        // אם התאריך מאושר, נשמור את התאריך ב-date_confirmed
        if (isConfirmed) {
          dateConfirmedStr = earningDate;
        }
      }
      
      // לוג לדיבוג
      if (!earning.date && !earning.report_date) {
        console.log(`⚠️ Earning has no date field: ticker=${ticker}, using fromDate=${fromDate}`)
      }

      return {
        code: tickerCode,
        name: earning.name || earning.ticker,
        report_date: earningDate,
        date: earningDate, // תאריך דיווח
        date_confirmed: dateConfirmedStr, // תאריך מאושר (רק אם date_confirmed="1")
        time: earning.time || null, // שעת דיווח
        before_after_market,
        currency: earning.currency || 'USD',
        exchange: earning.exchange || null, // בורסה
        company_name: earning.name || null, // שם החברה
        period: earning.period || null, // תקופה (Q1, Q2, Q3, Q4, FY)
        period_year: earning.period_year || null, // שנת התקופה
        // EPS fields
        actual,
        estimate,
        difference,
        percent,
        eps_prior: earning.eps_prior ? cleanNumericValue(earning.eps_prior) : null,
        eps_surprise: earning.eps_surprise ? cleanNumericValue(earning.eps_surprise) : difference,
        eps_surprise_percent: earning.eps_surprise_percent ? cleanNumericValue(earning.eps_surprise_percent) : percent,
        // Revenue fields
        revenue_actual,
        revenue_estimate_avg: revenue_estimate_avg,
        revenue_estimate_low: null, // Benzinga לא מחזיר low/high
        revenue_estimate_high: null,
        revenue_estimate_year_ago: earning.revenue_prior ? cleanNumericValue(earning.revenue_prior) : null,
        revenue_estimate_analysts_count: null, // Benzinga לא מחזיר
        revenue_estimate_growth: null, // Benzinga לא מחזיר
        revenue_surprise,
        revenue_surprise_percent,
        revenue_yoy,
        // Metadata
        importance: earning.importance || null, // רמת חשיבות (0-5)
        notes: earning.notes || null, // הערות
        benzinga_updated: earning.updated || null, // Unix timestamp
      };
    })

    let totalProcessed = 0
    let totalInserted = 0
    let totalFiltered = 0
    let filteredReasons: Record<string, number> = {}

    // עיבוד כל דיווח תוצאות
    for (const earnings of convertedEarnings) {
      totalProcessed++

      try {
        // לוג לפני הסינון
        if (totalProcessed <= 5) {
          console.log(`🔍 Processing earnings ${totalProcessed}: code=${earnings.code}, report_date=${earnings.report_date}`)
        }
        
        const prepared = prepareEarningsRecord(earnings, {
          requireUSCode: true,
          skipPreferredShares: true
        })

        if (!prepared) {
          totalFiltered++
          // בדיקה למה נסנן
          if (!earnings.code) {
            filteredReasons['no_code'] = (filteredReasons['no_code'] || 0) + 1
          } else if (!earnings.code.endsWith('.US')) {
            filteredReasons['no_us_code'] = (filteredReasons['no_us_code'] || 0) + 1
          } else if (!earnings.report_date) {
            filteredReasons['no_report_date'] = (filteredReasons['no_report_date'] || 0) + 1
          } else if (earnings.code.includes('-P') || earnings.code.includes('-W')) {
            filteredReasons['preferred_shares'] = (filteredReasons['preferred_shares'] || 0) + 1
          } else {
            filteredReasons['unknown'] = (filteredReasons['unknown'] || 0) + 1
          }
          
          if (totalFiltered <= 5) {
            console.log(`🔍 Filtered out: code=${earnings.code}, report_date=${earnings.report_date}`)
          }
          continue
        }

        if (prepared.meta.adjusted) {
          console.log(
            `🕒 Adjusted ${earnings.code} report date ${earnings.report_date} → ${prepared.record.report_date} (${prepared.meta.adjustmentReason})`
          )
        }

        const { error: upsertError } = await supabase
          .from('earnings_calendar')
          .upsert(prepared.record, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })

        if (upsertError) {
          console.error('❌ Error upserting earnings:', upsertError)
        } else {
          totalInserted++
        }

      } catch (error) {
        console.error('❌ Error processing earnings:', error)
      }
    }

    console.log(`✅ Earnings sync completed: ${totalInserted}/${totalProcessed} records processed`)
    console.log(`📊 Filtering stats:`)
    console.log(`   ├─ Total processed: ${totalProcessed}`)
    console.log(`   ├─ Total inserted: ${totalInserted}`)
    console.log(`   ├─ Total filtered: ${totalFiltered}`)
    console.log(`   └─ Filter reasons:`, filteredReasons)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Earnings synchronized successfully',
        processed: totalProcessed,
        inserted: totalInserted,
        dateRange: `${fromDate} to ${toDate}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Earnings sync error:', error)
    
    const errorMessage = error && typeof error === 'object' && 'message' in error 
      ? String(error.message) 
      : 'Unknown error occurred'

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
