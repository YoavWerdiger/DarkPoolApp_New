// מפת תרגומים מאנגלית לעברית לשמות אירועים כלכליים
// מבוסס על שמות נפוצים מ-Benzinga API

export const ECONOMIC_EVENT_TRANSLATIONS: { [key: string]: string } = {
  // מדיניות מוניטרית
  'FOMC': 'ישיבת הפד - החלטת ריבית',
  'FOMC Meeting': 'ישיבת הפד',
  'FOMC Minutes': 'פרוטוקול ישיבת הפד',
  'Fed Funds Rate': 'ריבית הבסיס',
  'Federal Reserve Rate Decision': 'החלטת ריבית הפד',
  'Fed Balance Sheet': 'מאזן הפד',
  'Beige Book': 'דוח ביג בוק',
  'Fed Chair': 'יו"ר הפד',
  'Powell': 'יו"ר הפד - פאוול',
  'Federal Reserve': 'הפדרל ריזרב',
  'Interest Rate': 'ריבית',
  'Rate Decision': 'החלטת ריבית',
  'Monetary Policy': 'מדיניות מוניטרית',
  
  // אינפלציה
  'CPI': 'מדד המחירים לצרכן',
  'Consumer Price Index': 'מדד המחירים לצרכן',
  'Core CPI': 'מדד המחירים לצרכן (ללא מזון ואנרגיה)',
  'PPI': 'מדד מחירי היצרנים',
  'Producer Price Index': 'מדד מחירי היצרנים',
  'Core PPI': 'מדד מחירי היצרנים (ללא מזון ואנרגיה)',
  'PCE': 'מדד הוצאות הצריכה',
  'Personal Consumption Expenditures': 'מדד הוצאות הצריכה',
  'Core PCE': 'מדד הוצאות הצריכה (ללא מזון ואנרגיה)',
  'Inflation': 'אינפלציה',
  'Import Price': 'מדד מחירי היבוא',
  'Export Price': 'מדד מחירי היצוא',
  'CPI Energy': 'מדד מחירי אנרגיה',
  'CPI Food': 'מדד מחירי מזון',
  
  // שוק עבודה
  'NFP': 'תעסוקה לא-חקלאית',
  'Non-Farm Payrolls': 'תעסוקה לא-חקלאית',
  'Unemployment': 'שיעור אבטלה',
  'Unemployment Rate': 'שיעור אבטלה',
  'Jobless Claims': 'תביעות אבטלה',
  'Initial Jobless Claims': 'תביעות אבטלה שבועיות',
  'ADP': 'דוח תעסוקה ADP',
  'ADP Employment': 'דוח תעסוקה ADP',
  'JOLTS': 'מספר משרות פנויות',
  'Job Openings': 'מספר משרות פנויות',
  'Hourly Earnings': 'שכר ממוצע לשעה',
  'Average Hourly Earnings': 'שכר ממוצע לשעה',
  'Labor Participation': 'שיעור השתתפות בכוח העבודה',
  'Labor Force Participation Rate': 'שיעור השתתפות בכוח העבודה',
  
  // צמיחה
  'GDP': 'תוצר מקומי גולמי',
  'Gross Domestic Product': 'תוצר מקומי גולמי',
  'Real GDP': 'תוצר מקומי גולמי (מתואם לאינפלציה)',
  'GDP Growth': 'צמיחת תוצר',
  'Retail Sales': 'מכירות קמעונאיות',
  'Retail Ex Auto': 'מכירות קמעונאיות (ללא רכב)',
  'Industrial Production': 'תפוקה תעשייתית',
  'Manufacturing': 'ייצור',
  'Capacity Utilization': 'ניצול קיבולת',
  'Business Inventories': 'מלאי עסקי',
  'Durable Goods': 'מוצרים עמידים',
  'Durable Goods Orders': 'הזמנות למוצרים עמידים',
  'Factory Orders': 'הזמנות מפעלים',
  'Personal Consumption': 'הוצאות צריכה אישית',
  
  // סנטימנט
  'ISM Manufacturing': 'מדד ISM ייצור',
  'ISM Services': 'מדד ISM שירותים',
  'Consumer Confidence': 'ביטחון צרכנים',
  'Michigan Sentiment': 'מדד סנטימנט מישיגן',
  'Business Confidence': 'ביטחון עסקי',
  
  // נדל"ן
  'Housing Starts': 'התחלות בנייה',
  'Building Permits': 'היתרי בנייה',
  'Existing Home Sales': 'מכירות בתים קיימים',
  'New Home Sales': 'מכירות בתים חדשים',
  'NAHB': 'מדד סנטימנט בונים',
  'Case-Shiller': 'מדד מחירי בתים Case-Shiller',
  
  // סחר
  'Trade Balance': 'מאזן סחר',
  'Exports': 'יצוא',
  'Imports': 'יבוא',
  'Current Account': 'מאזן שוטף',
  
  // שווקים
  'VIX': 'מדד תנודתיות VIX',
  'S&P 500': 'מדד S&P 500',
  'Dow Jones': 'מדד דאו ג\'ונס',
  'NASDAQ': 'מדד נאסד"ק',
  'Dollar Index': 'מדד הדולר',
  'USD/EUR': 'דולר/יורו',
  'USD/JPY': 'דולר/ין',
  'USD/GBP': 'דולר/פאונד',
  
  // אג"ח
  '10-Year Treasury': 'אג"ח 10 שנים',
  '2-Year Treasury': 'אג"ח 2 שנים',
  '30-Year Treasury': 'אג"ח 30 שנים',
  '3-Month Treasury': 'אג"ח 3 חודשים',
  'Yield Curve': 'עקומת תשואות',
  'Treasury': 'אג"ח ממשלתי',
  
  // אחר
  'Personal Income': 'הכנסה אישית',
  'Bank Credit': 'אשראי בנקאי',
  'Weekly Economic Index': 'מדד כלכלי שבועי',
};

// פונקציה לתרגום שם אירוע מאנגלית לעברית
export function translateEconomicEventName(eventName: string): string {
  if (!eventName || eventName.trim() === '') {
    return eventName;
  }
  
  // חיפוש תרגום מדויק
  const exactMatch = ECONOMIC_EVENT_TRANSLATIONS[eventName];
  if (exactMatch) {
    return exactMatch;
  }
  
  // חיפוש תרגום לפי מילות מפתח (case-insensitive)
  const eventNameLower = eventName.toLowerCase();
  
  for (const [english, hebrew] of Object.entries(ECONOMIC_EVENT_TRANSLATIONS)) {
    const englishLower = english.toLowerCase();
    
    // בדיקה אם שם האירוע מכיל את המילה המפתח
    if (eventNameLower.includes(englishLower) || englishLower.includes(eventNameLower)) {
      return hebrew;
    }
  }
  
  // אם לא נמצא תרגום, נחזיר את השם המקורי
  return eventName;
}

// פונקציה לתרגום עם fallback - מנסה למצוא תרגום חלקי
export function translateEconomicEventNameSmart(eventName: string): string {
  if (!eventName || eventName.trim() === '') {
    return eventName;
  }
  
  // חיפוש תרגום מדויק
  const exactMatch = ECONOMIC_EVENT_TRANSLATIONS[eventName];
  if (exactMatch) {
    return exactMatch;
  }
  
  // חיפוש לפי מילות מפתח - מחפש את התרגום הארוך ביותר שמתאים
  const eventNameLower = eventName.toLowerCase();
  let bestMatch: { key: string; translation: string; length: number } | null = null;
  
  for (const [english, hebrew] of Object.entries(ECONOMIC_EVENT_TRANSLATIONS)) {
    const englishLower = english.toLowerCase();
    
    // בדיקה אם שם האירוע מכיל את המילה המפתח או להיפך
    if (eventNameLower.includes(englishLower) || englishLower.includes(eventNameLower)) {
      const matchLength = Math.min(englishLower.length, eventNameLower.length);
      if (!bestMatch || matchLength > bestMatch.length) {
        bestMatch = { key: english, translation: hebrew, length: matchLength };
      }
    }
  }
  
  if (bestMatch) {
    return bestMatch.translation;
  }
  
  // אם לא נמצא תרגום, נחזיר את השם המקורי
  return eventName;
}









