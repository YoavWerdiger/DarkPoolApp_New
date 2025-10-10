// Daily Economic Sync - Simple Version
// שולף נתונים כלכליים ישירות מ-FRED API ומעדכן את Supabase DB

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FRED_API_KEY = 'f4d63bd9fddd00b175c1c99ca49b4247'
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred'

const EODHD_API_KEY = '68e3c3af900997.85677801'
const EODHD_BASE_URL = 'https://eodhd.com/api'

interface EconomicEvent {
  id: string
  title: string
  country: string
  currency: string
  importance: 'high' | 'medium' | 'low'
  date: string
  time: string
  actual: string
  forecast: string
  previous: string
  description: string
  category: string
  impact: string
  source: string
}

// רשימת מדדי FRED חשובים ומעניינים למשקיעים - מכסה את כל הקטגוריות החשובות
const FRED_SERIES = [
  // מדיניות מוניטרית (חשוב מאוד לשוקים!) ⭐
  { id: 'FEDFUNDS', name: '💰 ריבית הפד (Federal Funds Rate)', category: 'מדיניות מוניטרית', importance: 'high' },
  { id: 'DGS10', name: '📈 תשואת אג"ח 10 שנים', category: 'מדיניות מוניטרית', importance: 'high' },
  { id: 'DGS2', name: '📊 תשואת אג"ח 2 שנים', category: 'מדיניות מוניטרית', importance: 'high' },
  { id: 'DGS5', name: '📊 תשואת אג"ח 5 שנים', category: 'מדיניות מוניטרית', importance: 'high' },
  { id: 'T10Y2Y', name: '📉 פער תשואות 10Y-2Y (Yield Curve)', category: 'מדיניות מוניטרית', importance: 'high' },
  { id: 'T10Y3M', name: '📉 פער תשואות 10Y-3M', category: 'מדיניות מוניטרית', importance: 'high' },
  { id: 'DGS30', name: '📈 תשואת אג"ח 30 שנים', category: 'מדיניות מוניטרית', importance: 'medium' },
  { id: 'DGS1', name: '📊 תשואת אג"ח שנה', category: 'מדיניות מוניטרית', importance: 'medium' },
  { id: 'DGS3MO', name: '📊 תשואת אג"ח 3 חודשים', category: 'מדיניות מוניטרית', importance: 'medium' },
  
  // אינפלציה (חשוב מאוד!) ⭐
  { id: 'CPIAUCSL', name: '📊 מדד המחירים לצרכן (CPI)', category: 'אינפלציה', importance: 'high' },
  { id: 'CPILFESL', name: '📊 CPI ליבה (ללא מזון ואנרגיה)', category: 'אינפלציה', importance: 'high' },
  { id: 'PPIACO', name: '🏭 מדד מחירי יצרן (PPI)', category: 'אינפלציה', importance: 'high' },
  { id: 'PCEPILFE', name: '💵 PCE Core - מדד אינפלציה מועדף של הפד', category: 'אינפלציה', importance: 'high' },
  { id: 'PCE', name: '💳 הוצאות צריכה פרטית (PCE)', category: 'אינפלציה', importance: 'high' },
  { id: 'PCEPI', name: '📊 מדד מחירי PCE', category: 'אינפלציה', importance: 'high' },
  
  // תעסוקה (חשוב מאוד!) ⭐
  { id: 'PAYEMS', name: '👔 משרות בשכר - NFP (Non-Farm Payrolls)', category: 'תעסוקה', importance: 'high' },
  { id: 'UNRATE', name: '📉 שיעור אבטלה', category: 'תעסוקה', importance: 'high' },
  { id: 'ICSA', name: '📋 תביעות אבטלה שבועיות', category: 'תעסוקה', importance: 'high' },
  { id: 'UNEMPLOY', name: '👥 מספר מובטלים', category: 'תעסוקה', importance: 'medium' },
  { id: 'CES0500000003', name: '💰 שכר ממוצע לשעה', category: 'תעסוקה', importance: 'high' },
  { id: 'CIVPART', name: '👥 שיעור השתתפות בכוח העבודה', category: 'תעסוקה', importance: 'medium' },
  
  // צמיחה כלכלית ⭐
  { id: 'GDP', name: '🌍 תוצר גולמי (GDP)', category: 'צמיחה כלכלית', importance: 'high' },
  { id: 'INDPRO', name: '🏭 ייצור תעשייתי', category: 'צמיחה כלכלית', importance: 'medium' },
  { id: 'TCU', name: '⚙️ ניצול קיבולת תעשייתית', category: 'צמיחה כלכלית', importance: 'medium' },
  { id: 'IPMANSICS', name: '🏭 ייצור תעשייתי - ייצור', category: 'צמיחה כלכלית', importance: 'medium' },
  
  // צריכה (חשוב!)
  { id: 'RSXFS', name: '🛍️ מכירות קמעונאיות', category: 'צריכה', importance: 'high' },
  { id: 'UMCSENT', name: '😊 אמון צרכן - מישיגן', category: 'צריכה', importance: 'medium' },
  { id: 'DSPIC96', name: '💰 הכנסה אישית פנויה', category: 'צריכה', importance: 'medium' },
  
  // נדל"ן
  { id: 'HOUST', name: '🏗️ התחלות בנייה', category: 'נדל"ן', importance: 'medium' },
  { id: 'PERMIT', name: '📋 היתרי בנייה', category: 'נדל"ן', importance: 'medium' },
  { id: 'CSUSHPISA', name: '🏠 מדד Case-Shiller - מחירי דיור', category: 'נדל"ן', importance: 'medium' },
  { id: 'MORTGAGE30US', name: '🏠 ריבית משכנתא 30 שנה', category: 'נדל"ן', importance: 'medium' },
  
  // סחר חוץ
  { id: 'BOPGSTB', name: '🌐 מאזן סחר', category: 'סחר חוץ', importance: 'medium' },
  
  // שוקי הון (חשוב למשקיעים!) ⭐
  { id: 'VIXCLS', name: '📊 VIX - מדד פחד/תנודתיות', category: 'שוקי הון', importance: 'high' },
  { id: 'DEXUSEU', name: '💱 שער דולר/יורו', category: 'מטבעות', importance: 'medium' },
  { id: 'DEXJPUS', name: '💴 שער דולר/ין', category: 'מטבעות', importance: 'medium' },
  { id: 'DEXCHUS', name: '💴 שער דולר/יואן', category: 'מטבעות', importance: 'medium' },
  { id: 'DEXUSUK', name: '💷 שער דולר/פאונד', category: 'מטבעות', importance: 'medium' },
  
  // אנרגיה
  { id: 'DCOILWTICO', name: '🛢️ נפט WTI', category: 'אנרגיה', importance: 'medium' },
  { id: 'DCOILBRENTEU', name: '🛢️ נפט ברנט', category: 'אנרגיה', importance: 'medium' },
  { id: 'GASREGW', name: '⛽ מחיר בנזין ממוצע', category: 'אנרגיה', importance: 'low' },
  
  // מדדי שוק
  { id: 'SP500', name: '📈 S&P 500', category: 'שוקי הון', importance: 'high' },
  { id: 'NASDAQCOM', name: '📈 NASDAQ Composite', category: 'שוקי הון', importance: 'high' },
  { id: 'DJIA', name: '📈 Dow Jones', category: 'שוקי הון', importance: 'high' },
];

// פונקציה לקביעת חשיבות אירוע
function determineImportance(eventType: string): 'high' | 'medium' | 'low' {
  const type = eventType.toLowerCase();
  
  const highImportance = [
    'cpi', 'consumer price', 'pce', 'inflation',
    'nfp', 'nonfarm', 'employment', 'payroll', 'unemployment', 'jobless',
    'gdp', 'gross domestic',
    'fomc', 'federal reserve', 'fed meeting', 'interest rate', 'rate decision',
    'ppi', 'producer price',
    'retail sales', 'consumer spending',
    'ism manufacturing', 'ism services',
    'housing starts', 'building permits',
    'durable goods', 'factory orders'
  ];
  
  const mediumImportance = [
    'manufacturing', 'industrial production',
    'housing', 'construction', 'home sales',
    'consumer confidence', 'consumer sentiment',
    'trade balance', 'import', 'export',
    'leading index', 'business inventories',
    'personal income', 'personal spending',
    'productivity', 'unit labor cost'
  ];
  
  if (highImportance.some(keyword => type.includes(keyword))) return 'high';
  if (mediumImportance.some(keyword => type.includes(keyword))) return 'medium';
  return 'low';
}

// פונקציה לתרגום שם האירוע לעברית
function translateEventTitle(eventType: string): string {
  const type = eventType.toLowerCase();
  
  // תרגומים ספציפיים
  const translations: { [key: string]: string } = {
    // מדיניות מוניטרית
    'fomc statement': '📢 הצהרת הפד (FOMC)',
    'fomc meeting': '🏦 ישיבת הפד (FOMC)',
    'fed chair speech': '🎤 נאום יו"ר הפד',
    'interest rate decision': '💰 החלטת ריבית',
    'beige book': '📖 ספר בז\' - דו"ח כלכלי',
    
    // אינפלציה
    'cpi': '📊 מדד המחירים לצרכן (CPI)',
    'core cpi': '📊 CPI ליבה',
    'ppi': '🏭 מדד מחירי יצרן (PPI)',
    'pce': '💳 הוצאות צריכה (PCE)',
    'core pce': '💵 PCE ליבה',
    
    // תעסוקה
    'nfp': '👔 משרות חדשות (NFP)',
    'non-farm payrolls': '👔 משרות מחוץ לחקלאות',
    'unemployment rate': '📉 שיעור אבטלה',
    'jobless claims': '📋 תביעות אבטלה',
    'initial jobless claims': '📋 תביעות אבטלה ראשוניות',
    'adp employment': '👥 דו"ח תעסוקה ADP',
    
    // צמיחה
    'gdp': '🌍 תוצר גולמי (GDP)',
    'retail sales': '🛍️ מכירות קמעונאיות',
    'industrial production': '🏭 ייצור תעשייתי',
    'capacity utilization': '⚙️ ניצול קיבולת',
    'durable goods': '📦 הזמנות מוצרי מחיים',
    
    // סקרים
    'ism manufacturing': '🏭 ISM ייצור',
    'ism services': '🏢 ISM שירותים',
    'consumer confidence': '😊 אמון צרכן',
    'consumer sentiment': '😊 סנטימנט צרכן',
    
    // נדל"ן
    'housing starts': '🏗️ התחלות בנייה',
    'building permits': '📋 היתרי בנייה',
    'existing home sales': '🏠 מכירות דירות קיימות',
    'new home sales': '🏡 מכירות דירות חדשות',
    
    // סחר
    'trade balance': '🌐 מאזן סחר',
  };
  
  // נסה למצוא תרגום ישיר
  for (const [key, value] of Object.entries(translations)) {
    if (type.includes(key)) {
      return value;
    }
  }
  
  // אם אין תרגום - תן איקון לפי קטגוריה
  if (type.includes('fed') || type.includes('fomc') || type.includes('rate')) {
    return `💰 ${eventType}`;
  }
  if (type.includes('employ') || type.includes('job') || type.includes('payroll')) {
    return `👔 ${eventType}`;
  }
  if (type.includes('cpi') || type.includes('ppi') || type.includes('inflation')) {
    return `📊 ${eventType}`;
  }
  if (type.includes('gdp') || type.includes('growth')) {
    return `🌍 ${eventType}`;
  }
  if (type.includes('retail') || type.includes('sales')) {
    return `🛍️ ${eventType}`;
  }
  if (type.includes('housing') || type.includes('home')) {
    return `🏠 ${eventType}`;
  }
  
  return eventType;
}

// פונקציה לקביעת קטגוריה
function determineCategory(eventType: string): string {
  const type = eventType.toLowerCase();
  
  if (type.includes('cpi') || type.includes('ppi') || type.includes('inflation') || type.includes('price')) return 'אינפלציה';
  if (type.includes('employment') || type.includes('nfp') || type.includes('unemployment') || type.includes('jobless')) return 'תעסוקה';
  if (type.includes('gdp') || type.includes('growth') || type.includes('production')) return 'צמיחה כלכלית';
  if (type.includes('retail') || type.includes('sales') || type.includes('consumer')) return 'צריכה';
  if (type.includes('housing') || type.includes('construction') || type.includes('building')) return 'נדל"ן';
  if (type.includes('manufacturing') || type.includes('industrial')) return 'תעשייה';
  if (type.includes('fed') || type.includes('fomc') || type.includes('interest') || type.includes('rate')) return 'מדיניות מוניטרית';
  if (type.includes('trade') || type.includes('import') || type.includes('export')) return 'סחר חוץ';
  
  return 'כלכלה כללית';
}

serve(async (req) => {
  try {
    console.log('🚀 Daily Economic Sync (Simple) started')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const events: EconomicEvent[] = []
    
    // תאריך התחלה וסיום (3 חודשים אחורה ו-3 חודשים קדימה)
    const today = new Date()
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 3)
    const startDate = new Date(today)
    startDate.setMonth(startDate.getMonth() - 3)
    
    const endDateStr = endDate.toISOString().split('T')[0]
    const startDateStr = startDate.toISOString().split('T')[0]
    
    console.log(`📅 Fetching FRED data from ${startDateStr} to ${endDateStr}`)
    
    // שליפת נתונים מכל סדרה
    for (const series of FRED_SERIES) {
      try {
        const url = `${FRED_BASE_URL}/series/observations?series_id=${series.id}&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDateStr}&observation_end=${endDateStr}`
        
        const response = await fetch(url)
        if (!response.ok) continue
        
        const data = await response.json()
        
        if (data.observations && Array.isArray(data.observations)) {
          // קח את כל התצפיות בטווח (מקסימום 100)
          const recentObs = data.observations.slice(-100)
          
          recentObs.forEach((obs: any) => {
            if (obs.value && obs.value !== '.') {
              events.push({
                id: `fred_${series.id}_${obs.date}`,
                title: series.name,
                country: 'ארצות הברית',
                currency: 'USD',
                importance: series.importance,
                date: obs.date,
                time: '14:30',
                actual: obs.value,
                forecast: '',
                previous: '',
                description: `${series.name} - FRED`,
                category: series.category,
                impact: series.importance,
                source: 'FRED API'
              })
            }
          })
        }
      } catch (error) {
        console.log(`❌ Error fetching ${series.id}:`, error)
      }
    }
    
    console.log(`📊 Collected ${events.length} events from FRED`)
    
    // הוספת אירועים עתידיים מ-EODHD
    // EODHD מחזיר תוצאות טובות יותר עם קריאות לחודש בודד
    try {
      console.log('🔄 Fetching events from EODHD (monthly batches)...')
      
      // יצירת טווחים חודשיים
      const currentMonth = today.getMonth()
      const currentYear = today.getFullYear()
      
      // שלוף 6 חודשים: 3 אחורה + 3 קדימה
      for (let i = -3; i <= 3; i++) {
        const monthDate = new Date(currentYear, currentMonth + i, 1)
        const nextMonthDate = new Date(currentYear, currentMonth + i + 1, 0) // אחרון בחודש
        
        const monthStart = monthDate.toISOString().split('T')[0]
        const monthEnd = nextMonthDate.toISOString().split('T')[0]
        
        const eodhdUrl = `${EODHD_BASE_URL}/economic-events?api_token=${EODHD_API_KEY}&from=${monthStart}&to=${monthEnd}&country=US&fmt=json`
        console.log(`🔄 EODHD month ${i}: ${monthStart} to ${monthEnd}`)
        
        try {
          const eodhdResponse = await fetch(eodhdUrl)
          
          if (eodhdResponse.ok) {
            const eodhdData = await eodhdResponse.json()
            
            if (Array.isArray(eodhdData) && eodhdData.length > 0) {
              console.log(`📊 Found ${eodhdData.length} events for ${monthStart}`)
              
              eodhdData.forEach((event: any) => {
                const eventDate = event.date.split(' ')[0]
                const eventTime = event.date.includes(' ') ? event.date.split(' ')[1].substring(0, 5) : ''
                
                const importance = determineImportance(event.type)
                const translatedTitle = translateEventTitle(event.type)
                
                events.push({
                  id: `eodhd_${event.type}_${event.date}`.replace(/[^a-zA-Z0-9_]/g, '_'),
                  title: translatedTitle,
                  country: 'ארצות הברית',
                  currency: 'USD',
                  importance: importance,
                  date: eventDate,
                  time: eventTime,
                  actual: event.actual?.toString() || '',
                  forecast: event.estimate?.toString() || '',
                  previous: event.previous?.toString() || '',
                  description: `${event.type}${event.period ? ` (${event.period})` : ''}${event.comparison ? ` - ${event.comparison}` : ''}`,
                  category: determineCategory(event.type),
                  impact: importance,
                  source: 'EODHD'
                })
              })
            }
          }
        } catch (monthError) {
          console.log(`❌ Error fetching EODHD for ${monthStart}:`, monthError)
        }
      }
      
      console.log(`📊 Total EODHD events collected`)
    } catch (error) {
      console.log('❌ EODHD fetch error:', error)
    }
    
    console.log(`📊 Total events before dedup: ${events.length} (FRED + EODHD)`)
    
    // הסרת כפילויות לפי ID
    const uniqueEvents = events.filter((event, index, self) => 
      index === self.findIndex((e) => e.id === event.id)
    )
    
    console.log(`📊 Unique events: ${uniqueEvents.length} (removed ${events.length - uniqueEvents.length} duplicates)`)
    
    // שמירה ב-Supabase
    if (uniqueEvents.length > 0) {
      // שימוש ב-UPSERT כדי למנוע כפילויות
      // זה יעדכן אירועים קיימים ויוסיף חדשים
      const { data: upsertData, error: upsertError } = await supabase
        .from('economic_events')
        .upsert(uniqueEvents, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
        .select()
      
      if (upsertError) {
        console.error('❌ Upsert error:', upsertError)
        return new Response(JSON.stringify({ 
          success: false, 
          error: upsertError.message 
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 500
        })
      }
      
      console.log(`✅ Successfully saved ${upsertData?.length || 0} events`)
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: `Successfully synced ${uniqueEvents.length} economic events`,
      eventsCount: uniqueEvents.length,
      totalBeforeDedup: events.length,
      duplicatesRemoved: events.length - uniqueEvents.length
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })
    
  } catch (error) {
    console.error('❌ Daily Economic Sync error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

