// Sync Economic Calendar - New Clean Function
// שולף אירועי יומן כלכלי מ-EODHD

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EODHD_API_KEY = '68e3c3af900997.85677801'

// תרגום כותרות לעברית
function translateTitle(eventType: string): string {
  const type = eventType.toLowerCase();
  
  const translations: { [key: string]: string } = {
    // מדיניות מוניטרית
    'fomc statement': '📢 הצהרת הפד',
    'fomc meeting': '🏦 ישיבת הפד',
    'fed chair powell speech': '🎤 נאום יו"ר הפד',
    'fed chair speech': '🎤 נאום יו"ר הפד',
    'fed waller speech': '🎤 נאום פד - וולר',
    'fed collins speech': '🎤 נאום פד - קולינס',
    'fed bowman speech': '🎤 נאום פד - באומן',
    'interest rate decision': '💰 החלטת ריבית',
    'beige book': '📖 ספר בז\' של הפד',
    'fed beige book': '📖 ספר בז\' של הפד',
    
    // אינפלציה
    'cpi s.a': '📊 CPI - מדד מחירים לצרכן',
    'inflation rate': '📊 שיעור אינפלציה',
    'core inflation rate': '📊 אינפלציה ליבה',
    'ppi': '🏭 PPI - מדד מחירי יצרן',
    'pce price index': '💳 מדד מחירי PCE',
    'core pce price index': '💳 PCE ליבה',
    
    // תעסוקה
    'non farm payrolls': '👔 NFP - משרות חדשות',
    'nonfarm payrolls private': '👔 NFP - משרות פרטיות',
    'unemployment rate': '📉 שיעור אבטלה',
    'initial jobless claims': '📋 תביעות אבטלה ראשוניות',
    'jobless claims': '📋 תביעות אבטלה',
    'average hourly earnings': '💰 שכר ממוצע לשעה',
    'employment cost index': '💰 מדד עלות תעסוקה',
    'employment wages': '💰 שכר תעסוקה',
    'nfib business optimism': '😊 אופטימיות עסקית NFIB',
    
    // צמיחה
    'gdp': '🌍 GDP - תוצר',
    'retail sales': '🛍️ מכירות קמעונאיות',
    'wholesale sales': '🏭 מכירות סיטונאיות',
    'industrial production': '🏭 ייצור תעשייתי',
    'personal income': '💵 הכנסה אישית',
    'personal spending': '💳 הוצאות אישיות',
    
    // סקרים
    'michigan consumer sentiment': '😊 סנטימנט צרכן מישיגן',
    'michigan inflation expectations': '📊 ציפיות אינפלציה',
    'michigan consumer expectations': '😊 ציפיות צרכן',
    'michigan current conditions': '📊 תנאים נוכחיים',
    'consumer confidence': '😊 אמון צרכן',
    'chicago pmi': '🏭 PMI שיקגו',
    
    // נדל"ן
    'housing starts': '🏗️ התחלות בנייה',
    'building permits': '📋 היתרי בנייה',
    'construction spending': '🏗️ הוצאות בנייה',
    '30-year mortgage rate': '🏠 ריבית משכנתא 30 שנה',
    '15-year mortgage rate': '🏠 ריבית משכנתא 15 שנה',
    
    // סחר ותקציב
    'trade balance': '🌐 מאזן סחר',
    'budget balance': '💰 מאזן תקציבי',
    'federal budget': '💰 תקציב פדרלי',
    
    // אנרגיה
    'baker hughes oil rig count': '🛢️ מספר אסדות נפט',
    'api crude oil stock change': '🛢️ שינוי מלאי נפט API',
    'eia crude oil stocks': '🛢️ מלאי נפט EIA',
    'eia natural gas stocks': '⚡ מלאי גז טבעי',
    
    // אחר
    'opec monthly report': '🛢️ דו"ח חודשי OPEC',
    'imf meeting': '🌐 פגישת IMF',
    'wasde report': '🌾 דו"ח WASDE',
    'redbook': '📊 רדבוק',
  };
  
  for (const [key, value] of Object.entries(translations)) {
    if (type.includes(key)) return value;
  }
  
  // תרגומים כלליים
  if (type.includes('speech')) return `🎤 נאום - ${eventType}`;
  if (type.includes('auction')) return `💵 מכירה פומבית - ${eventType}`;
  
  return eventType;
}

serve(async (req) => {
  try {
    console.log('🚀 Economic Calendar Sync Started')
    
    // חיבור ל-Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // חישוב תאריכים: 3 חודשים אחורה + 3 קדימה מהיום
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    
    const startDate = new Date(today)
    startDate.setMonth(startDate.getMonth() - 3)
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 3)
    
    const from = startDate.toISOString().split('T')[0]
    const to = endDate.toISOString().split('T')[0]
    
    console.log(`📅 Today: ${todayStr}`)
    console.log(`📅 Range: ${from} to ${to}`)
    
    // שליפה מ-EODHD
    const url = `https://eodhd.com/api/economic-events?api_token=${EODHD_API_KEY}&from=${from}&to=${to}&country=US&limit=1000&fmt=json`
    console.log(`🔄 Calling EODHD...`)
    
    const res = await fetch(url)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    
    const apiData = await res.json()
    if (!Array.isArray(apiData)) throw new Error('Invalid API response')
    
    console.log(`📊 EODHD returned: ${apiData.length} events`)
    
    // המרה לפורמט שלנו
    const events = apiData.map((e: any) => {
      const [date, time] = e.date.split(' ')
      const shortTime = time ? time.substring(0, 5) : '00:00'
      
      const originalType = e.type || 'Economic Event'
      const translatedTitle = translateTitle(originalType)
      
      console.log(`🔄 "${originalType}" → "${translatedTitle}"`)
      
      // קביעת חשיבות
      const type = originalType.toLowerCase()
      let importance = 'medium'
      if (type.includes('cpi') || type.includes('nfp') || type.includes('employment') || 
          type.includes('gdp') || type.includes('fomc') || type.includes('pce') || 
          type.includes('ppi') || type.includes('retail sales') || type.includes('unemployment')) {
        importance = 'high'
      }
      
      // קטגוריה
      let category = 'כלכלה'
      if (type.includes('cpi') || type.includes('ppi') || type.includes('inflation') || type.includes('pce')) category = 'אינפלציה'
      else if (type.includes('employ') || type.includes('nfp') || type.includes('jobless')) category = 'תעסוקה'
      else if (type.includes('gdp')) category = 'צמיחה'
      else if (type.includes('fed') || type.includes('fomc') || type.includes('rate')) category = 'מדיניות מוניטרית'
      
      return {
        id: `econ_${e.type}_${e.date}`.replace(/[^a-zA-Z0-9_]/g, '_'),
        title: translatedTitle,
        country: 'ארצות הברית',
        currency: 'USD',
        importance,
        date,
        time: shortTime,
        actual: e.actual?.toString() || '',
        forecast: e.estimate?.toString() || '',
        previous: e.previous?.toString() || '',
        description: `${e.type}${e.period ? ` (${e.period})` : ''}`,
        category,
        impact: importance,
        source: 'EODHD'
      }
    })
    
    console.log(`📊 Processed: ${events.length} events`)
    
    // הסרת כפילויות
    const unique = events.filter((e, i, arr) => 
      arr.findIndex(x => x.id === e.id) === i
    )
    
    console.log(`📊 Unique: ${unique.length} events`)
    
    // שמירה במסד נתונים
    if (unique.length > 0) {
      const { error } = await supabase
        .from('economic_events')
        .upsert(unique, { onConflict: 'id' })
      
      if (error) {
        console.error('❌ DB Error:', error)
        throw error
      }
      
      console.log(`✅ Saved to DB`)
    }
    
    // סטטיסטיקות
    const todayCount = unique.filter(e => e.date === todayStr).length
    const highCount = unique.filter(e => e.importance === 'high').length
    
    return new Response(JSON.stringify({
      success: true,
      total: unique.length,
      range: `${from} to ${to}`,
      today: todayCount,
      highImportance: highCount
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })
    
  } catch (error: any) {
    console.error('❌ Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error'
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

