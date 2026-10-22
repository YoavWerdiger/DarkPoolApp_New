// מפת תרגומים מאנגלית לעברית לשמות אירועים כלכליים
// מבוסס על שמות נפוצים מ-Benzinga API
// שמור בסנכרון עם supabase/functions/_shared/economicEventTranslations.ts

// תרגומים מדויקים לכל הכותרות שמגיעות בפועל מ-Benzinga (קודמים להתאמה חלקית —
// שהפכה למשל את כל «Interest Rate Projection» ל«ריבית» ואת כל מדדי ISM לאותו שם)
export const ECONOMIC_EVENT_EXACT_TITLES: { [key: string]: string } = {
  "10-Year Note Auction": "מכרז אג\"ח ל-10 שנים",
  "10-Year TIPS Auction": "מכרז אג\"ח צמודות מדד ל-10 שנים (TIPS)",
  "20-Year Bond Auction": "מכרז אג\"ח ל-20 שנה",
  "2-Year Note Auction": "מכרז אג\"ח לשנתיים",
  "30-Year Bond Auction": "מכרז אג\"ח ל-30 שנה",
  "30-Year TIPS Auction": "מכרז אג\"ח צמודות מדד ל-30 שנה (TIPS)",
  "3-Year Note Auction": "מכרז אג\"ח ל-3 שנים",
  "5-Year Note Auction": "מכרז אג\"ח ל-5 שנים",
  "5-year TIPS Auction": "מכרז אג\"ח צמודות מדד ל-5 שנים (TIPS)",
  "7-Year Note Auction": "מכרז אג\"ח ל-7 שנים",
  "ADP Nonfarm Employment Change": "שינוי במשרות במגזר הפרטי (ADP)",
  "API Weekly Crude Oil Stock": "מלאי נפט גולמי שבועי (API)",
  "Average Hourly Earnings (MoM)": "שכר ממוצע לשעה (חודשי)",
  "Average Hourly Earnings (YoY)": "שכר ממוצע לשעה (שנתי)",
  "Bank Stress Test Info": "תוצאות מבחני הקיצון לבנקים",
  "Building Permits": "היתרי בנייה",
  "Building Permits (MoM)": "היתרי בנייה (חודשי)",
  "Building Permits (MoM) - Prelim": "היתרי בנייה (חודשי) – ראשוני",
  "Building Permits - Prelim": "היתרי בנייה (ראשוני)",
  "Business Inventories (MoM)": "מלאי עסקי (חודשי)",
  "CFTC Nasdaq 100 Speculative Net Positions": "פוזיציות ספקולטיביות נטו בנאסד\"ק 100 (CFTC)",
  "Challenger Job Cuts": "פיטורים מתוכננים (צ׳לנג׳ר)",
  "Chicago PMI": "מדד מנהלי הרכש של שיקגו",
  "Construction Spending (MoM)": "הוצאות בנייה (חודשי)",
  "Consumer Confidence": "אמון הצרכנים",
  "Consumer Credit": "אשראי צרכני",
  "Consumer Inflation Expectations": "ציפיות אינפלציה של הצרכנים",
  "Core CPI (MoM)": "מדד המחירים לצרכן (ללא מזון ואנרגיה) (חודשי)",
  "Core CPI (YoY)": "מדד המחירים לצרכן (ללא מזון ואנרגיה) (שנתי)",
  "Core PCE - Price Index (MoM)": "מדד הוצאות הצריכה (ללא מזון ואנרגיה) (חודשי)",
  "Core PCE - Price Index (YoY)": "מדד הוצאות הצריכה (ללא מזון ואנרגיה) (שנתי)",
  "Core PCE Prices (QoQ)": "מדד הוצאות הצריכה (ללא מזון ואנרגיה) (רבעוני)",
  "Core PCE Prices (QoQ) - Prelim": "מדד הוצאות הצריכה (ללא מזון ואנרגיה) (רבעוני) – ראשוני",
  "Core PPI (MoM)": "מדד מחירי היצרנים (ללא מזון ואנרגיה) (חודשי)",
  "CPI (MoM)": "מדד המחירים לצרכן (חודשי)",
  "CPI (YoY)": "מדד המחירים לצרכן (שנתי)",
  "Crude Oil Inventories": "מלאי נפט גולמי (EIA)",
  "Cushing Crude Oil Inventories": "מלאי נפט גולמי בקושינג",
  "Durable Goods Orders ex Defense (MoM)": "הזמנות מוצרים בני-קיימא ללא ביטחון (חודשי)",
  "Durable Goods Orders ex Transportation (MoM)": "הזמנות מוצרים בני-קיימא ללא תחבורה (חודשי)",
  "Durable Goods Orders (MoM)": "הזמנות מוצרים בני-קיימא (חודשי)",
  "EIA Short-Term Energy Outlook": "תחזית אנרגיה לטווח קצר (EIA)",
  "Existing Home Sales": "מכירות בתים קיימים",
  "Existing Home Sales (MoM)": "מכירות בתים קיימים (חודשי)",
  "Export Price Index (MoM)": "מדד מחירי היצוא (חודשי)",
  "Exports": "יצוא",
  "Factory Orders (MoM)": "הזמנות מפעלים (חודשי)",
  "Federal Budget Balance": "מאזן התקציב הפדרלי",
  "Fed Interest Rate Decision": "החלטת הריבית של הפד",
  "Fed Monetary Policy Report": "דוח המדיניות המוניטרית של הפד",
  "Fed's Balance Sheet": "מאזן הפד",
  "Fed's Barkin speech": "נאום חבר הפד ברקין",
  "Fed's Barr Speaks": "נאום חבר הפד בר",
  "Fed's Beige Book": "הספר הבז׳ של הפד",
  "Fed's Bowman speech": "נאום חברת הפד באומן",
  "Fed's Collins Speaks": "נאום חברת הפד קולינס",
  "Fed's Daly Speaks": "נאום חברת הפד דיילי",
  "Fed's Goolsbee Speaks": "נאום חבר הפד גולסבי",
  "Fed's Governor Cook Testifies": "עדות חברת הפד קוק",
  "Fed's Governor Jefferson Speaks": "נאום חבר הפד ג׳פרסון",
  "Fed's Kashkari Speaks": "נאום חבר הפד קשקרי",
  "Fed's Logan Speaks": "נאום חברת הפד לוגן",
  "Fed's Williams Speaks": "נאום חבר הפד וויליאמס",
  "Fed Waller Speaks": "נאום חבר הפד וולר",
  "FOMC Economic Projections": "תחזיות כלכליות של הפד",
  "FOMC Meeting Minutes": "פרוטוקול ישיבת הפד",
  "FOMC Press Conference": "מסיבת עיתונאים של הפד",
  "FOMC Statement": "הודעת הפד",
  "GDP Price Index": "מדד מחירי התוצר",
  "GDP Price Index - Prelim": "מדד מחירי התוצר (ראשוני)",
  "GDP (QoQ)": "תוצר מקומי גולמי (רבעוני)",
  "GDP (QoQ) - Prelim": "תוצר מקומי גולמי (רבעוני) – ראשוני",
  "Goods Orders Non Defense Ex Air (MoM)": "הזמנות מוצרי הון ללא ביטחון ותעופה (חודשי)",
  "Goods Trade Balance": "מאזן סחר בסחורות",
  "Goods Trade Balance - Prelim": "מאזן סחר בסחורות (ראשוני)",
  "House Price Index (MoM)": "מדד מחירי הדיור (חודשי)",
  "Housing Starts Change (MoM)": "התחלות בנייה (חודשי)",
  "Housing Starts (MoM)": "התחלות בנייה (חודשי)",
  "IEA Monthly Report": "הדוח החודשי של סוכנות האנרגיה (IEA)",
  "IMF Meetings": "פגישות קרן המטבע (IMF)",
  "Import Price Index (MoM)": "מדד מחירי היבוא (חודשי)",
  "Imports": "יבוא",
  "Industrial Production (YoY)": "ייצור תעשייתי (שנתי)",
  "Initial Jobless Claims": "תביעות אבטלה שבועיות",
  "Interest Rate Projection - 1st Yr": "תחזית ריבית – שנה ראשונה",
  "Interest Rate Projection - 2nd Yr": "תחזית ריבית – שנה שנייה",
  "Interest Rate Projection - 3rd Yr": "תחזית ריבית – שנה שלישית",
  "Interest Rate Projection - Current": "תחזית ריבית – השנה",
  "Interest Rate Projection - Longer": "תחזית ריבית – טווח ארוך",
  "ISM Manufacturing Employment": "מדד התעסוקה בתעשייה (ISM)",
  "ISM Manufacturing New Orders Index": "מדד ההזמנות החדשות בתעשייה (ISM)",
  "ISM Manufacturing PMI": "מדד מנהלי הרכש בתעשייה (ISM)",
  "ISM Manufacturing Prices": "מדד המחירים בתעשייה (ISM)",
  "ISM Services Employment Index": "מדד התעסוקה בשירותים (ISM)",
  "ISM Services New Orders Index": "מדד ההזמנות החדשות בשירותים (ISM)",
  "ISM Services PMI": "מדד מנהלי הרכש בשירותים (ISM)",
  "ISM Services Prices": "מדד המחירים בשירותים (ISM)",
  "Jackson Hole Symposium": "כנס ג׳קסון הול",
  "JOLTS Job Openings": "משרות פנויות (JOLTS)",
  "Labor Force Participation Rate": "שיעור ההשתתפות בכוח העבודה",
  "Loan Officer Survey": "סקר מנהלי האשראי בבנקים",
  "Michigan 5-Year Inflation Expectations": "ציפיות אינפלציה ל-5 שנים (מישיגן)",
  "Michigan 5-Year Inflation Expectations - Prelim": "ציפיות אינפלציה ל-5 שנים (מישיגן) – ראשוני",
  "Michigan Consumer Expectations": "ציפיות הצרכנים (מישיגן)",
  "Michigan Consumer Expectations - Prelim": "ציפיות הצרכנים (מישיגן) – ראשוני",
  "Michigan Consumer Sentiment": "סנטימנט הצרכנים (מישיגן)",
  "Michigan Consumer Sentiment - Prelim": "סנטימנט הצרכנים (מישיגן) – ראשוני",
  "Michigan Inflation Expectations": "ציפיות אינפלציה לשנה (מישיגן)",
  "Michigan Inflation Expectations - Prelim": "ציפיות אינפלציה לשנה (מישיגן) – ראשוני",
  "NAHB Housing Market Index": "מדד שוק הדיור (NAHB)",
  "New Home Sales Change (MoM)": "מכירות בתים חדשים (חודשי)",
  "Nonfarm Payrolls": "משרות חדשות מחוץ לחקלאות (NFP)",
  "Nonfarm Productivity (QoQ)": "פריון העבודה (רבעוני)",
  "Nonfarm Productivity (QoQ) - Prelim": "פריון העבודה (רבעוני) – ראשוני",
  "NY Empire State Manufacturing Index": "מדד הייצור של ניו יורק (אמפייר סטייט)",
  "OPEC Meeting": "ישיבת אופ״ק",
  "OPEC Monthly Report": "הדוח החודשי של אופ״ק",
  "PCE Price index (MoM)": "מדד הוצאות הצריכה (חודשי)",
  "PCE Price index (YoY)": "מדד הוצאות הצריכה (שנתי)",
  "Pending Home Sales (MoM)": "עסקאות דיור ממתינות (חודשי)",
  "Personal Income (MoM)": "הכנסה אישית (חודשי)",
  "Personal Spending (MoM)": "הוצאה אישית (חודשי)",
  "Philadelphia Fed Manufacturing Survey": "סקר הייצור של פילדלפיה",
  "Philly Fed Employment": "מדד התעסוקה של פילדלפיה",
  "PPI ex. Food/Energy/Transport (MoM)": "מדד מחירי היצרנים ללא מזון, אנרגיה ותחבורה (חודשי)",
  "PPI ex. Food/Energy/Transport (YoY)": "מדד מחירי היצרנים ללא מזון, אנרגיה ותחבורה (שנתי)",
  "PPI (MoM)": "מדד מחירי היצרנים (חודשי)",
  "PPI (YoY)": "מדד מחירי היצרנים (שנתי)",
  "Private Nonfarm Payrolls": "משרות חדשות במגזר הפרטי",
  "Real Personal Consumption": "צריכה פרטית ריאלית",
  "Retail Sales Control Group (MoM)": "מכירות קמעונאיות – קבוצת הליבה (חודשי)",
  "Retail Sales ex Autos (MoM)": "מכירות קמעונאיות ללא רכב (חודשי)",
  "Retail Sales (MoM)": "מכירות קמעונאיות (חודשי)",
  "S&P/CS HPI Composite - 20 n.s.a. (MoM)": "מדד מחירי הדיור קייס-שילר 20 ערים (חודשי)",
  "S&P/CS HPI Composite - 20 n.s.a. (YoY)": "מדד מחירי הדיור קייס-שילר 20 ערים (שנתי)",
  "S&P Global Composite PMI": "מדד מנהלי הרכש המשולב (S&P Global)",
  "S&P Global Composite PMI - Prelim": "מדד מנהלי הרכש המשולב (S&P Global) – ראשוני",
  "S&P Global Manufacturing PMI": "מדד מנהלי הרכש בתעשייה (S&P Global)",
  "S&P Global Manufacturing PMI - Prelim": "מדד מנהלי הרכש בתעשייה (S&P Global) – ראשוני",
  "S&P Global Services PMI": "מדד מנהלי הרכש בשירותים (S&P Global)",
  "S&P Global Services PMI - Prelim": "מדד מנהלי הרכש בשירותים (S&P Global) – ראשוני",
  "U6 Unemployment Rate": "שיעור האבטלה הרחב (U6)",
  "Unemployment Rate": "שיעור אבטלה",
  "Unit Labor Costs (QoQ)": "עלות עבודה ליחידה (רבעוני)",
  "Unit Labor Costs (QoQ) - Prelim": "עלות עבודה ליחידה (רבעוני) – ראשוני",
  "U.S. Baker Hughes Total Rig Count": "מספר אסדות הקידוח (בייקר יוז)",
  "US Leading Index": "מדד המובילים של ארה״ב",
  "U.S. President Trump Speaks": "נאום הנשיא טראמפ",
  "WASDE Report": "דוח היצע וביקוש חקלאי (WASDE)",
};

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

/** תקופת השוואה מהכותרת (MoM/YoY/QoQ) — חשוב ל-CPI וכו' כי המספר הוא שינוי, לא רמת מדד */
const PERIOD_TOKEN_RE = /\((MoM|YoY|QoQ|Y\/Y|M\/M|Q\/Q)\)/i;
const PERIOD_HEBREW: Record<string, string> = {
  mom: '(חודשי)',
  'm/m': '(חודשי)',
  yoy: '(שנתי)',
  'y/y': '(שנתי)',
  qoq: '(רבעוני)',
  'q/q': '(רבעוני)',
};

function extractComparisonPeriod(eventName: string): { base: string; periodHe: string } {
  const match = eventName.match(PERIOD_TOKEN_RE);
  if (!match || match.index == null) {
    return { base: eventName.trim(), periodHe: '' };
  }
  const key = match[1].toLowerCase();
  const periodHe = PERIOD_HEBREW[key] || `(${match[1]})`;
  const base = `${eventName.slice(0, match.index)} ${eventName.slice(match.index + match[0].length)}`
    .replace(/\s+/g, ' ')
    .trim();
  return { base, periodHe };
}

function withComparisonPeriod(translated: string, periodHe: string): string {
  if (!periodHe) return translated;
  if (translated.includes(periodHe)) return translated;
  return `${translated} ${periodHe}`;
}

function translateEconomicEventBase(eventName: string): string {
  if (!eventName || eventName.trim() === '') {
    return eventName;
  }

  const exactMatch =
    ECONOMIC_EVENT_EXACT_TITLES[eventName.trim()] ?? ECONOMIC_EVENT_TRANSLATIONS[eventName];
  if (exactMatch) {
    return exactMatch;
  }

  const eventNameLower = eventName.toLowerCase();
  let bestMatch: { translation: string; length: number } | null = null;

  for (const [english, hebrew] of Object.entries(ECONOMIC_EVENT_TRANSLATIONS)) {
    const englishLower = english.toLowerCase();

    if (eventNameLower.includes(englishLower) || englishLower.includes(eventNameLower)) {
      const matchLength = Math.min(englishLower.length, eventNameLower.length);
      if (!bestMatch || matchLength > bestMatch.length) {
        bestMatch = { translation: hebrew, length: matchLength };
      }
    }
  }

  return bestMatch ? bestMatch.translation : eventName;
}

// פונקציה לתרגום שם אירוע מאנגלית לעברית
export function translateEconomicEventName(eventName: string): string {
  if (!eventName || eventName.trim() === '') {
    return eventName;
  }

  const exactMatch =
    ECONOMIC_EVENT_EXACT_TITLES[eventName.trim()] ?? ECONOMIC_EVENT_TRANSLATIONS[eventName];
  if (exactMatch) {
    return exactMatch;
  }

  const { base, periodHe } = extractComparisonPeriod(eventName);
  return withComparisonPeriod(translateEconomicEventBase(base), periodHe);
}

// פונקציה לתרגום עם fallback - מנסה למצוא תרגום חלקי
export function translateEconomicEventNameSmart(eventName: string): string {
  if (!eventName || eventName.trim() === '') {
    return eventName;
  }

  const exactMatch =
    ECONOMIC_EVENT_EXACT_TITLES[eventName.trim()] ?? ECONOMIC_EVENT_TRANSLATIONS[eventName];
  if (exactMatch) {
    return exactMatch;
  }

  const { base, periodHe } = extractComparisonPeriod(eventName);
  return withComparisonPeriod(translateEconomicEventBase(base), periodHe);
}









