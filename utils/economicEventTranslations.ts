import i18n from '../lib/i18n';
// מפת תרגומים מאנגלית לעברית לשמות אירועים כלכליים
// מבוסס על שמות נפוצים מ-Benzinga API
// שמור בסנכרון עם supabase/functions/_shared/economicEventTranslations.ts

// תרגומים מדויקים לכל הכותרות שמגיעות בפועל מ-Benzinga (קודמים להתאמה חלקית —
// שהפכה למשל את כל «Interest Rate Projection» ל«ריבית» ואת כל מדדי ISM לאותו שם)
export const ECONOMIC_EVENT_EXACT_TITLES: { [key: string]: string } = {
  "10-Year Note Auction": i18n.t('auto.utils__economicEventTranslations.s1'),
  "10-Year TIPS Auction": i18n.t('auto.utils__economicEventTranslations.s2'),
  "20-Year Bond Auction": i18n.t('auto.utils__economicEventTranslations.s3'),
  "2-Year Note Auction": i18n.t('auto.utils__economicEventTranslations.s4'),
  "30-Year Bond Auction": i18n.t('auto.utils__economicEventTranslations.s5'),
  "30-Year TIPS Auction": i18n.t('auto.utils__economicEventTranslations.s6'),
  "3-Year Note Auction": i18n.t('auto.utils__economicEventTranslations.s7'),
  "5-Year Note Auction": i18n.t('auto.utils__economicEventTranslations.s8'),
  "5-year TIPS Auction": i18n.t('auto.utils__economicEventTranslations.s9'),
  "7-Year Note Auction": i18n.t('auto.utils__economicEventTranslations.s10'),
  "ADP Nonfarm Employment Change": i18n.t('auto.utils__economicEventTranslations.s11'),
  "API Weekly Crude Oil Stock": i18n.t('auto.utils__economicEventTranslations.s12'),
  "Average Hourly Earnings (MoM)": i18n.t('auto.utils__economicEventTranslations.s13'),
  "Average Hourly Earnings (YoY)": i18n.t('auto.utils__economicEventTranslations.s14'),
  "Bank Stress Test Info": i18n.t('auto.utils__economicEventTranslations.s15'),
  "Building Permits": i18n.t('auto.utils__economicEventTranslations.s16'),
  "Building Permits (MoM)": i18n.t('auto.utils__economicEventTranslations.s17'),
  "Building Permits (MoM) - Prelim": i18n.t('auto.utils__economicEventTranslations.s18'),
  "Building Permits - Prelim": i18n.t('auto.utils__economicEventTranslations.s19'),
  "Business Inventories (MoM)": i18n.t('auto.utils__economicEventTranslations.s20'),
  "CFTC Nasdaq 100 Speculative Net Positions": i18n.t('auto.utils__economicEventTranslations.s21'),
  "Challenger Job Cuts": i18n.t('auto.utils__economicEventTranslations.s22'),
  "Chicago PMI": i18n.t('auto.utils__economicEventTranslations.s23'),
  "Construction Spending (MoM)": i18n.t('auto.utils__economicEventTranslations.s24'),
  "Consumer Confidence": i18n.t('auto.utils__economicEventTranslations.s25'),
  "Consumer Credit": i18n.t('auto.utils__economicEventTranslations.s26'),
  "Consumer Inflation Expectations": i18n.t('auto.utils__economicEventTranslations.s27'),
  "Core CPI (MoM)": i18n.t('auto.utils__economicEventTranslations.s28'),
  "Core CPI (YoY)": i18n.t('auto.utils__economicEventTranslations.s29'),
  "Core PCE - Price Index (MoM)": i18n.t('auto.utils__economicEventTranslations.s30'),
  "Core PCE - Price Index (YoY)": i18n.t('auto.utils__economicEventTranslations.s31'),
  "Core PCE Prices (QoQ)": i18n.t('auto.utils__economicEventTranslations.s32'),
  "Core PCE Prices (QoQ) - Prelim": i18n.t('auto.utils__economicEventTranslations.s33'),
  "Core PPI (MoM)": i18n.t('auto.utils__economicEventTranslations.s34'),
  "CPI (MoM)": i18n.t('auto.utils__economicEventTranslations.s35'),
  "CPI (YoY)": i18n.t('auto.utils__economicEventTranslations.s36'),
  "Crude Oil Inventories": i18n.t('auto.utils__economicEventTranslations.s37'),
  "Cushing Crude Oil Inventories": i18n.t('auto.utils__economicEventTranslations.s38'),
  "Durable Goods Orders ex Defense (MoM)": i18n.t('auto.utils__economicEventTranslations.s39'),
  "Durable Goods Orders ex Transportation (MoM)": i18n.t('auto.utils__economicEventTranslations.s40'),
  "Durable Goods Orders (MoM)": i18n.t('auto.utils__economicEventTranslations.s41'),
  "EIA Short-Term Energy Outlook": i18n.t('auto.utils__economicEventTranslations.s42'),
  "Existing Home Sales": i18n.t('auto.utils__economicEventTranslations.s43'),
  "Existing Home Sales (MoM)": i18n.t('auto.utils__economicEventTranslations.s44'),
  "Export Price Index (MoM)": i18n.t('auto.utils__economicEventTranslations.s45'),
  "Exports": i18n.t('auto.utils__economicEventTranslations.s46'),
  "Factory Orders (MoM)": i18n.t('auto.utils__economicEventTranslations.s47'),
  "Federal Budget Balance": i18n.t('auto.utils__economicEventTranslations.s48'),
  "Fed Interest Rate Decision": i18n.t('auto.utils__economicEventTranslations.s49'),
  "Fed Monetary Policy Report": i18n.t('auto.utils__economicEventTranslations.s50'),
  "Fed's Balance Sheet": i18n.t('auto.utils__economicEventTranslations.s51'),
  "Fed's Barkin speech": i18n.t('auto.utils__economicEventTranslations.s52'),
  "Fed's Barr Speaks": i18n.t('auto.utils__economicEventTranslations.s53'),
  "Fed's Beige Book": i18n.t('auto.utils__economicEventTranslations.s54'),
  "Fed's Bowman speech": i18n.t('auto.utils__economicEventTranslations.s55'),
  "Fed's Collins Speaks": i18n.t('auto.utils__economicEventTranslations.s56'),
  "Fed's Daly Speaks": i18n.t('auto.utils__economicEventTranslations.s57'),
  "Fed's Goolsbee Speaks": i18n.t('auto.utils__economicEventTranslations.s58'),
  "Fed's Governor Cook Testifies": i18n.t('auto.utils__economicEventTranslations.s59'),
  "Fed's Governor Jefferson Speaks": i18n.t('auto.utils__economicEventTranslations.s60'),
  "Fed's Kashkari Speaks": i18n.t('auto.utils__economicEventTranslations.s61'),
  "Fed's Logan Speaks": i18n.t('auto.utils__economicEventTranslations.s62'),
  "Fed's Williams Speaks": i18n.t('auto.utils__economicEventTranslations.s63'),
  "Fed Waller Speaks": i18n.t('auto.utils__economicEventTranslations.s64'),
  "FOMC Economic Projections": i18n.t('auto.utils__economicEventTranslations.s65'),
  "FOMC Meeting Minutes": i18n.t('auto.utils__economicEventTranslations.s66'),
  "FOMC Press Conference": i18n.t('auto.utils__economicEventTranslations.s67'),
  "FOMC Statement": i18n.t('auto.utils__economicEventTranslations.s68'),
  "GDP Price Index": i18n.t('auto.utils__economicEventTranslations.s69'),
  "GDP Price Index - Prelim": i18n.t('auto.utils__economicEventTranslations.s70'),
  "GDP (QoQ)": i18n.t('auto.utils__economicEventTranslations.s71'),
  "GDP (QoQ) - Prelim": i18n.t('auto.utils__economicEventTranslations.s72'),
  "Goods Orders Non Defense Ex Air (MoM)": i18n.t('auto.utils__economicEventTranslations.s73'),
  "Goods Trade Balance": i18n.t('auto.utils__economicEventTranslations.s74'),
  "Goods Trade Balance - Prelim": i18n.t('auto.utils__economicEventTranslations.s75'),
  "House Price Index (MoM)": i18n.t('auto.utils__economicEventTranslations.s76'),
  "Housing Starts Change (MoM)": i18n.t('auto.utils__economicEventTranslations.s77'),
  "Housing Starts (MoM)": i18n.t('auto.utils__economicEventTranslations.s77'),
  "IEA Monthly Report": i18n.t('auto.utils__economicEventTranslations.s78'),
  "IMF Meetings": i18n.t('auto.utils__economicEventTranslations.s79'),
  "Import Price Index (MoM)": i18n.t('auto.utils__economicEventTranslations.s80'),
  "Imports": i18n.t('auto.utils__economicEventTranslations.s81'),
  "Industrial Production (YoY)": i18n.t('auto.utils__economicEventTranslations.s82'),
  "Initial Jobless Claims": i18n.t('auto.utils__economicEventTranslations.s83'),
  "Interest Rate Projection - 1st Yr": i18n.t('auto.utils__economicEventTranslations.s84'),
  "Interest Rate Projection - 2nd Yr": i18n.t('auto.utils__economicEventTranslations.s85'),
  "Interest Rate Projection - 3rd Yr": i18n.t('auto.utils__economicEventTranslations.s86'),
  "Interest Rate Projection - Current": i18n.t('auto.utils__economicEventTranslations.s87'),
  "Interest Rate Projection - Longer": i18n.t('auto.utils__economicEventTranslations.s88'),
  "ISM Manufacturing Employment": i18n.t('auto.utils__economicEventTranslations.s89'),
  "ISM Manufacturing New Orders Index": i18n.t('auto.utils__economicEventTranslations.s90'),
  "ISM Manufacturing PMI": i18n.t('auto.utils__economicEventTranslations.s91'),
  "ISM Manufacturing Prices": i18n.t('auto.utils__economicEventTranslations.s92'),
  "ISM Services Employment Index": i18n.t('auto.utils__economicEventTranslations.s93'),
  "ISM Services New Orders Index": i18n.t('auto.utils__economicEventTranslations.s94'),
  "ISM Services PMI": i18n.t('auto.utils__economicEventTranslations.s95'),
  "ISM Services Prices": i18n.t('auto.utils__economicEventTranslations.s96'),
  "Jackson Hole Symposium": i18n.t('auto.utils__economicEventTranslations.s97'),
  "JOLTS Job Openings": i18n.t('auto.utils__economicEventTranslations.s98'),
  "Labor Force Participation Rate": i18n.t('auto.utils__economicEventTranslations.s99'),
  "Loan Officer Survey": i18n.t('auto.utils__economicEventTranslations.s100'),
  "Michigan 5-Year Inflation Expectations": i18n.t('auto.utils__economicEventTranslations.s101'),
  "Michigan 5-Year Inflation Expectations - Prelim": i18n.t('auto.utils__economicEventTranslations.s102'),
  "Michigan Consumer Expectations": i18n.t('auto.utils__economicEventTranslations.s103'),
  "Michigan Consumer Expectations - Prelim": i18n.t('auto.utils__economicEventTranslations.s104'),
  "Michigan Consumer Sentiment": i18n.t('auto.utils__economicEventTranslations.s105'),
  "Michigan Consumer Sentiment - Prelim": i18n.t('auto.utils__economicEventTranslations.s106'),
  "Michigan Inflation Expectations": i18n.t('auto.utils__economicEventTranslations.s107'),
  "Michigan Inflation Expectations - Prelim": i18n.t('auto.utils__economicEventTranslations.s108'),
  "NAHB Housing Market Index": i18n.t('auto.utils__economicEventTranslations.s109'),
  "New Home Sales Change (MoM)": i18n.t('auto.utils__economicEventTranslations.s110'),
  "Nonfarm Payrolls": i18n.t('auto.utils__economicEventTranslations.s111'),
  "Nonfarm Productivity (QoQ)": i18n.t('auto.utils__economicEventTranslations.s112'),
  "Nonfarm Productivity (QoQ) - Prelim": i18n.t('auto.utils__economicEventTranslations.s113'),
  "NY Empire State Manufacturing Index": i18n.t('auto.utils__economicEventTranslations.s114'),
  "OPEC Meeting": i18n.t('auto.utils__economicEventTranslations.s115'),
  "OPEC Monthly Report": i18n.t('auto.utils__economicEventTranslations.s116'),
  "PCE Price index (MoM)": i18n.t('auto.utils__economicEventTranslations.s117'),
  "PCE Price index (YoY)": i18n.t('auto.utils__economicEventTranslations.s118'),
  "Pending Home Sales (MoM)": i18n.t('auto.utils__economicEventTranslations.s119'),
  "Personal Income (MoM)": i18n.t('auto.utils__economicEventTranslations.s120'),
  "Personal Spending (MoM)": i18n.t('auto.utils__economicEventTranslations.s121'),
  "Philadelphia Fed Manufacturing Survey": i18n.t('auto.utils__economicEventTranslations.s122'),
  "Philly Fed Employment": i18n.t('auto.utils__economicEventTranslations.s123'),
  "PPI ex. Food/Energy/Transport (MoM)": i18n.t('auto.utils__economicEventTranslations.s124'),
  "PPI ex. Food/Energy/Transport (YoY)": i18n.t('auto.utils__economicEventTranslations.s125'),
  "PPI (MoM)": i18n.t('auto.utils__economicEventTranslations.s126'),
  "PPI (YoY)": i18n.t('auto.utils__economicEventTranslations.s127'),
  "Private Nonfarm Payrolls": i18n.t('auto.utils__economicEventTranslations.s128'),
  "Real Personal Consumption": i18n.t('auto.utils__economicEventTranslations.s129'),
  "Retail Sales Control Group (MoM)": i18n.t('auto.utils__economicEventTranslations.s130'),
  "Retail Sales ex Autos (MoM)": i18n.t('auto.utils__economicEventTranslations.s131'),
  "Retail Sales (MoM)": i18n.t('auto.utils__economicEventTranslations.s132'),
  "S&P/CS HPI Composite - 20 n.s.a. (MoM)": i18n.t('auto.utils__economicEventTranslations.s133'),
  "S&P/CS HPI Composite - 20 n.s.a. (YoY)": i18n.t('auto.utils__economicEventTranslations.s134'),
  "S&P Global Composite PMI": i18n.t('auto.utils__economicEventTranslations.s135'),
  "S&P Global Composite PMI - Prelim": i18n.t('auto.utils__economicEventTranslations.s136'),
  "S&P Global Manufacturing PMI": i18n.t('auto.utils__economicEventTranslations.s137'),
  "S&P Global Manufacturing PMI - Prelim": i18n.t('auto.utils__economicEventTranslations.s138'),
  "S&P Global Services PMI": i18n.t('auto.utils__economicEventTranslations.s139'),
  "S&P Global Services PMI - Prelim": i18n.t('auto.utils__economicEventTranslations.s140'),
  "U6 Unemployment Rate": i18n.t('auto.utils__economicEventTranslations.s141'),
  "Unemployment Rate": i18n.t('auto.utils__economicEventTranslations.s142'),
  "Unit Labor Costs (QoQ)": i18n.t('auto.utils__economicEventTranslations.s143'),
  "Unit Labor Costs (QoQ) - Prelim": i18n.t('auto.utils__economicEventTranslations.s144'),
  "U.S. Baker Hughes Total Rig Count": i18n.t('auto.utils__economicEventTranslations.s145'),
  "US Leading Index": i18n.t('auto.utils__economicEventTranslations.s146'),
  "U.S. President Trump Speaks": i18n.t('auto.utils__economicEventTranslations.s147'),
  "WASDE Report": i18n.t('auto.utils__economicEventTranslations.s148'),
};

export const ECONOMIC_EVENT_TRANSLATIONS: { [key: string]: string } = {
  // מדיניות מוניטרית
  'FOMC': i18n.t('auto.utils__economicEventTranslations.s149'),
  'FOMC Meeting': i18n.t('auto.utils__economicEventTranslations.s150'),
  'FOMC Minutes': i18n.t('auto.utils__economicEventTranslations.s66'),
  'Fed Funds Rate': i18n.t('auto.utils__economicEventTranslations.s151'),
  'Federal Reserve Rate Decision': i18n.t('auto.utils__economicEventTranslations.s152'),
  'Fed Balance Sheet': i18n.t('auto.utils__economicEventTranslations.s51'),
  'Beige Book': i18n.t('auto.utils__economicEventTranslations.s153'),
  'Fed Chair': i18n.t('auto.utils__economicEventTranslations.s154'),
  'Powell': i18n.t('auto.utils__economicEventTranslations.s155'),
  'Federal Reserve': i18n.t('auto.utils__economicEventTranslations.s156'),
  'Interest Rate': i18n.t('auto.utils__economicEventTranslations.s157'),
  'Rate Decision': i18n.t('auto.utils__economicEventTranslations.s158'),
  'Monetary Policy': i18n.t('auto.utils__economicEventTranslations.s159'),
  
  // אינפלציה
  'CPI': i18n.t('auto.utils__economicEventTranslations.s160'),
  'Consumer Price Index': i18n.t('auto.utils__economicEventTranslations.s160'),
  'Core CPI': i18n.t('auto.utils__economicEventTranslations.s161'),
  'PPI': i18n.t('auto.utils__economicEventTranslations.s162'),
  'Producer Price Index': i18n.t('auto.utils__economicEventTranslations.s162'),
  'Core PPI': i18n.t('auto.utils__economicEventTranslations.s163'),
  'PCE': i18n.t('auto.utils__economicEventTranslations.s164'),
  'Personal Consumption Expenditures': i18n.t('auto.utils__economicEventTranslations.s164'),
  'Core PCE': i18n.t('auto.utils__economicEventTranslations.s165'),
  'Inflation': i18n.t('auto.utils__economicEventTranslations.s166'),
  'Import Price': i18n.t('auto.utils__economicEventTranslations.s167'),
  'Export Price': i18n.t('auto.utils__economicEventTranslations.s168'),
  'CPI Energy': i18n.t('auto.utils__economicEventTranslations.s169'),
  'CPI Food': i18n.t('auto.utils__economicEventTranslations.s170'),
  
  // שוק עבודה
  'NFP': i18n.t('auto.utils__economicEventTranslations.s171'),
  'Non-Farm Payrolls': i18n.t('auto.utils__economicEventTranslations.s171'),
  'Unemployment': i18n.t('auto.utils__economicEventTranslations.s142'),
  'Unemployment Rate': i18n.t('auto.utils__economicEventTranslations.s142'),
  'Jobless Claims': i18n.t('auto.utils__economicEventTranslations.s172'),
  'Initial Jobless Claims': i18n.t('auto.utils__economicEventTranslations.s83'),
  'ADP': i18n.t('auto.utils__economicEventTranslations.s173'),
  'ADP Employment': i18n.t('auto.utils__economicEventTranslations.s173'),
  'JOLTS': i18n.t('auto.utils__economicEventTranslations.s174'),
  'Job Openings': i18n.t('auto.utils__economicEventTranslations.s174'),
  'Hourly Earnings': i18n.t('auto.utils__economicEventTranslations.s175'),
  'Average Hourly Earnings': i18n.t('auto.utils__economicEventTranslations.s175'),
  'Labor Participation': i18n.t('auto.utils__economicEventTranslations.s176'),
  'Labor Force Participation Rate': i18n.t('auto.utils__economicEventTranslations.s176'),
  
  // צמיחה
  'GDP': i18n.t('auto.utils__economicEventTranslations.s177'),
  'Gross Domestic Product': i18n.t('auto.utils__economicEventTranslations.s177'),
  'Real GDP': i18n.t('auto.utils__economicEventTranslations.s178'),
  'GDP Growth': i18n.t('auto.utils__economicEventTranslations.s179'),
  'Retail Sales': i18n.t('auto.utils__economicEventTranslations.s180'),
  'Retail Ex Auto': i18n.t('auto.utils__economicEventTranslations.s181'),
  'Industrial Production': i18n.t('auto.utils__economicEventTranslations.s182'),
  'Manufacturing': i18n.t('auto.utils__economicEventTranslations.s183'),
  'Capacity Utilization': i18n.t('auto.utils__economicEventTranslations.s184'),
  'Business Inventories': i18n.t('auto.utils__economicEventTranslations.s185'),
  'Durable Goods': i18n.t('auto.utils__economicEventTranslations.s186'),
  'Durable Goods Orders': i18n.t('auto.utils__economicEventTranslations.s187'),
  'Factory Orders': i18n.t('auto.utils__economicEventTranslations.s188'),
  'Personal Consumption': i18n.t('auto.utils__economicEventTranslations.s189'),
  
  // סנטימנט
  'ISM Manufacturing': i18n.t('auto.utils__economicEventTranslations.s190'),
  'ISM Services': i18n.t('auto.utils__economicEventTranslations.s191'),
  'Consumer Confidence': i18n.t('auto.utils__economicEventTranslations.s192'),
  'Michigan Sentiment': i18n.t('auto.utils__economicEventTranslations.s193'),
  'Business Confidence': i18n.t('auto.utils__economicEventTranslations.s194'),
  
  // נדל"ן
  'Housing Starts': i18n.t('auto.utils__economicEventTranslations.s195'),
  'Building Permits': i18n.t('auto.utils__economicEventTranslations.s16'),
  'Existing Home Sales': i18n.t('auto.utils__economicEventTranslations.s43'),
  'New Home Sales': i18n.t('auto.utils__economicEventTranslations.s196'),
  'NAHB': i18n.t('auto.utils__economicEventTranslations.s197'),
  'Case-Shiller': i18n.t('auto.utils__economicEventTranslations.s198'),
  
  // סחר
  'Trade Balance': i18n.t('auto.utils__economicEventTranslations.s199'),
  'Exports': i18n.t('auto.utils__economicEventTranslations.s46'),
  'Imports': i18n.t('auto.utils__economicEventTranslations.s81'),
  'Current Account': i18n.t('auto.utils__economicEventTranslations.s200'),
  
  // שווקים
  'VIX': i18n.t('auto.utils__economicEventTranslations.s201'),
  'S&P 500': i18n.t('auto.utils__economicEventTranslations.s202'),
  'Dow Jones': i18n.t('auto.utils__economicEventTranslations.s203'),
  'NASDAQ': i18n.t('auto.utils__economicEventTranslations.s204'),
  'Dollar Index': i18n.t('auto.utils__economicEventTranslations.s205'),
  'USD/EUR': i18n.t('auto.utils__economicEventTranslations.s206'),
  'USD/JPY': i18n.t('auto.utils__economicEventTranslations.s207'),
  'USD/GBP': i18n.t('auto.utils__economicEventTranslations.s208'),
  
  // אג"ח
  '10-Year Treasury': i18n.t('auto.utils__economicEventTranslations.s209'),
  '2-Year Treasury': i18n.t('auto.utils__economicEventTranslations.s210'),
  '30-Year Treasury': i18n.t('auto.utils__economicEventTranslations.s211'),
  '3-Month Treasury': i18n.t('auto.utils__economicEventTranslations.s212'),
  'Yield Curve': i18n.t('auto.utils__economicEventTranslations.s213'),
  'Treasury': i18n.t('auto.utils__economicEventTranslations.s214'),
  
  // אחר
  'Personal Income': i18n.t('auto.utils__economicEventTranslations.s215'),
  'Bank Credit': i18n.t('auto.utils__economicEventTranslations.s216'),
  'Weekly Economic Index': i18n.t('auto.utils__economicEventTranslations.s217'),
};

/** תקופת השוואה מהכותרת (MoM/YoY/QoQ) — חשוב ל-CPI וכו' כי המספר הוא שינוי, לא רמת מדד */
const PERIOD_TOKEN_RE = /\((MoM|YoY|QoQ|Y\/Y|M\/M|Q\/Q)\)/i;
const PERIOD_HEBREW: Record<string, string> = {
  mom: i18n.t('auto.utils__economicEventTranslations.s218'),
  'm/m': i18n.t('auto.utils__economicEventTranslations.s218'),
  yoy: i18n.t('auto.utils__economicEventTranslations.s219'),
  'y/y': i18n.t('auto.utils__economicEventTranslations.s219'),
  qoq: i18n.t('auto.utils__economicEventTranslations.s220'),
  'q/q': i18n.t('auto.utils__economicEventTranslations.s220'),
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









