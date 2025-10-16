export const ECONOMIC_INDICATOR_EXPLANATIONS: { [key: string]: string } = {
  
  // מדיניות מוניטרית
  'FOMC': 'ועדת השוק הפתוח של הפדרל ריזרב קובעת את ריבית הבסיס בארה"ב. העלאת ריבית נועדה לבלום אינפלציה אך מאטה צמיחה, בעוד הורדת ריבית מעודדת צמיחה. החלטות FOMC הן האירוע הכלכלי המשפיע ביותר על השווקים.',
  
  'Fed Funds Rate': 'ריבית הבסיס שבנקים גובים אחד מהשני על הלוואות לילה. זו הריבית המרכזית שקובעת הפד והיא משפיעה על כל הריביות במשק.',
  
  'Fed Balance Sheet': 'סך הנכסים בבעלות הפדרל ריזרב. הרחבת המאזן משמעה הזרמת כסף למשק והיא תומכת במניות, בעוד צמצום המאזן שואב נקודיות ומפעיל לחץ על השווקים.',
  
  'Beige Book': 'דוח כלכלי איכותי שמפרסם הפד 8 פעמים בשנה, המבוסס על ראיונות עם מנהלים ואנשי עסקים. הדוח יוצא שבועיים לפני ישיבת FOMC ונותן רמזים על החלטת הריבית הצפויה.',
  
  'FOMC Minutes': 'פרוטוקול מפורט של ישיבת FOMC, הכולל את הדיונים והשיקולים שהובילו להחלטת הריבית. מפורסם 3 שבועות אחרי הישיבה ומגלה את עמדות חברי הוועדה.',
  
  'Fed Chair': 'מסיבת עיתונאים של יו"ר הפדרל ריזרב לאחר החלטת ריבית. השוק מנתח כל מילה כדי להבין את כוונות הפד לגבי ריבית עתידית.',
  
  '10-Year Treasury': 'תשואת אג"ח ממשלתי אמריקאי לטווח 10 שנים. זו הריבית חסרת הסיכון שמשמשת בסיס לתמחור כל הנכסים במשק, כולל משכנתאות ומניות. עליה בתשואה משקפת חשש לאינפלציה או סיכון.',
  
  '2-Year Treasury': 'תשואת אג"ח ממשלתי לטווח שנתיים. מדד זה הכי רגיש להחלטות ריבית של הפד ומשקף את ציפיות השוק לריבית בשנתיים הקרובות.',
  
  '30-Year Treasury': 'תשואת אג"ח ממשלתי לטווח 30 שנה. משקפת ציפיות ארוכות טווח לאינפלציה וצמיחה כלכלית.',
  
  '3-Month Treasury': 'תשואת שטר חוב ממשלתי לטווח 3 חודשים. משמש כבסיס למדידת עקומת התשואות ומשקף את הריבית הקצרה ביותר במשק.',
  
  'Yield Curve': 'ההפרש בין תשואת אג"ח ל-10 שנים לבין תשואת אג"ח ל-2 שנים. עקומה הפוכה, כאשר תשואת 2 שנים גבוהה מ-10 שנים, נחשבת לאזהרה למיתון קרוב.',
  
  'Bank Credit': 'סך האשראי שהבנקים מעניקים לעסקים וצרכנים. עליה משקפת נכונות בנקים להלוות וכלכלה חזקה, ירידה מעידה על חולשה או הידוק תנאי אשראי.',

  // אינפלציה
  'CPI': 'מדד המחירים לצרכן מודד את השינוי במחירי סל קבוע של מוצרים ושירותים. עליה ב-CPI משקפת אינפלציה גבוהה ועשויה להוביל את הפד להעלות ריבית. יעד האינפלציה של הפד הוא 2% בשנה.',
  
  'Core CPI': 'מדד CPI ללא מזון ואנרגיה. מחירי מזון ואנרגיה תנודתיים ביותר, לכן Core CPI נחשב למדד נקי יותר של מגמת האינפלציה האמיתית. הפד מתמקד במדד זה יותר מב-CPI הרגיל.',
  
  'PPI': 'מדד מחירי היצרנים מודד שינויי מחירים ברמת הסיטונאי והייצור. עליה ב-PPI מעידה על עלויות ייצור גבוהות שצפויות לעבור לצרכן בעתיד, ולכן משמש מדד מוביל ל-CPI.',
  
  'Core PPI': 'מדד מחירי היצרנים ללא מזון ואנרגיה. מראה את מגמת עלויות הייצור הבסיסית מעבר לתנודות מחירי הסחורות.',
  
  'PCE': 'מדד הוצאות הצריכה האישית הוא מדד האינפלציה המועדף של הפד. המדד מקיף יותר מ-CPI ומתעדכן דינמית לפי שינויים בהרגלי הצריכה. יעד הפד הרשמי: 2% בשנה.',
  
  'Core PCE': 'מדד PCE ללא מזון ואנרגיה. זהו המדד שיו"ר הפד בוחן באופן יומי והוא מהווה את יעד האינפלציה הרשמי של הפדרל ריזרב.',
  
  'Import Price': 'מדד מחירי היבוא מודד את השינוי במחירי סחורות המיובאות לארה"ב. עליה משקפת לחץ אינפלציוני מבחוץ או חולשת דולר.',
  
  'Export Price': 'מדד מחירי היצוא מודד את השינוי במחירי סחורות המיוצאות מארה"ב. עליה משקפת ביקוש חזק או חוזק דולר.',
  
  'CPI Energy': 'רכיב האנרגיה במדד CPI, כולל נפט, גז וחשמל. תנודתי מאוד בשל תלות במחירי אנרגיה עולמיים.',
  
  'CPI Food': 'רכיב המזון במדד CPI. תנודתי בשל השפעת מזג אוויר, עונתיות ומחירי סחורות חקלאיות.',

  // שוק עבודה
  'NFP': 'תעסוקה לא-חקלאית מודדת את מספר המשרות שנוספו או אבדו במשק בחודש שעבר. זהו המדד המרכזי לבריאות שוק העבודה ואחד האירועים המשפיעים ביותר על השווקים. מתפרסם ביום שישי הראשון של כל חודש.',
  
  'Unemployment': 'שיעור האבטלה הוא אחוז מכוח העבודה שמחפש עבודה ואינו מועסק. אבטלה נמוכה משקפת כלכלה חזקה, אך אבטלה נמוכה מדי עלולה לגרום לעליית שכר ואינפלציה.',
  
  'Jobless Claims': 'מספר תביעות האבטלה השבועיות הוא המדד התדיר ביותר לבריאות שוק העבודה. מספר נמוך מתחת ל-200,000 משקף שוק עבודה חזק, מעל 300,000 מעיד על חולשה.',
  
  'ADP': 'דוח התעסוקה הפרטי של ADP מודד משרות שנוספו במגזר הפרטי. מתפרסם יומיים לפני NFP הרשמי ומשמש כתחזית מוקדמת.',
  
  'JOLTS': 'מספר המשרות הפנויות מודד ביקוש לעובדים. מספר גבוה משקף שוק עבודה חזק אך עלול להוביל לעליית שכר ואינפלציה.',
  
  'Hourly Earnings': 'שכר ממוצע לשעה מודד את קצב עליית השכר. עליה מהירה מעידה על לחץ אינפלציוני דרך עליית עלויות העבודה.',
  
  'Labor Participation': 'שיעור ההשתתפות בכוח העבודה מודד אחוז מהאוכלוסייה בגיל עבודה שמועסק או מחפש עבודה. ירידה עשויה להעיד על התייאשות מחיפוש עבודה.',

  // צמיחה
  'GDP': 'התוצר המקומי הגולמי הוא ערך כל הסחורות והשירותים שיוצרו במדינה ברבעון. זהו המדד המקיף ביותר לגודל ובריאות הכלכלה. צמיחה של 2-3% נחשבת בריאה.',
  
  'Real GDP': 'תוצר מקומי גולמי מתואם לאינפלציה, המראה צמיחה כלכלית אמיתית. זהו המדד המדויק ביותר למדידת התפתחות כלכלית.',
  
  'GDP Growth': 'שיעור הצמיחה הרבעוני או השנתי של התוצר. מעל 4% נחשב לצמיחה חזקה, מתחת ל-1% להאטה, ושלילי למיתון.',
  
  'Retail Sales': 'מכירות קמעונאיות מודדות את נפח המכירות בחנויות. מכיוון ש-70% מהכלכלה האמריקאית היא צריכה, מדד זה משקף את בריאות הצרכן ואת כיוון הכלכלה.',
  
  'Retail Ex Auto': 'מכירות קמעונאיות ללא רכב. מספק תמונה יציבה יותר של מגמת הצריכה מכיוון שמכירות רכב תנודתיות מאוד.',
  
  'Industrial Production': 'נפח הייצור במפעלים, מכרות ותשתיות. עליה משקפת ביקוש גבוה וכלכלה חזקה. מדד זה נחשב למוביל - עולה לפני צמיחה ויורד לפני מיתון.',
  
  'Manufacturing': 'נפח ייצור במגזר הייצור. מהווה חלק משמעותי מהפעילות התעשייתית ומעיד על בריאות המגזר התעשייתי.',
  
  'Capacity Utilization': 'אחוז מהקיבולת הייצורית שמנוצלת בפועל. רמה מעל 80% משקפת כלכלה חמה ומפעלים בעומס, מעל 82% מעלה חשש לאינפלציה בגלל מחסור בקיבולת.',
  
  'Business Inventories': 'רמת המלאי בעסקים. מלאי עולה מעיד על ביקוש חלש, בעוד מלאי יורד משקף ביקוש חזק. רמות מלאי משפיעות על החלטות ייצור עתידיות.',
  
  'Durable Goods': 'הזמנות למוצרים עמידים כמו מכונות, רכב ומכשירים. עליה בהזמנות מעידה על ביטחון עסקי והשקעות, ומהווה מדד מוביל לפעילות ייצור עתידית.',
  
  'Factory Orders': 'נפח כל ההזמנות החדשות למפעלים. הזמנה היום משמעה ייצור מחר, ולכן זהו מדד מוביל לפעילות תעשייתית ותעסוקה.',
  
  'Personal Consumption': 'הוצאות הצריכה האישית מהוות כ-70% מהתוצר האמריקאי. עליה מעידה על צרכן חזק וכלכלה צומחת.',

  // אינפלציה
  'Core CPI': 'מדד CPI ללא מזון ואנרגיה. מחירי מזון ואנרגיה תנודתיים מאוד, ולכן Core CPI נחשב למדד נקי ומדויק יותר של מגמת האינפלציה הבסיסית.',
  
  'PPI': 'מדד מחירי היצרנים מודד שינויי מחירים ברמת הייצור והסיטונאות. עליה ב-PPI מעידה על עלויות ייצור גבוהות שצפויות להתגלגל לצרכן, ולכן משמש מדד מוביל ל-CPI.',
  
  'Core PCE': 'מדד PCE ללא מזון ואנרגיה. זהו מדד האינפלציה המרכזי והמועדף של הפד, והוא משמש ליעד האינפלציה הרשמי של 2% בשנה.',

  // סנטימנט
  'ISM Manufacturing': 'סקר של מנהלי רכש בתעשיית הייצור. מדד מעל 50 משקף התרחבות, מתחת ל-50 התכווצות. זהו מדד מוביל המנבא מגמות כלכליות לפני שהן מתרחשות.',
  
  'ISM Services': 'סקר מנהלי רכש במגזר השירותים. מכיוון ששירותים מהווים כ-80% מהכלכלה האמריקאית, מדד זה חשוב יותר מ-ISM Manufacturing.',
  
  'PMI Manufacturing': 'מדד פעילות הייצור של S&P Global. דומה ל-ISM אך מבוסס על מתודולוגיה שונה ומדגם רחב יותר.',
  
  'PMI Services': 'מדד פעילות השירותים של S&P Global. משקף את פעילות המגזר השירותי שהוא עמוד השדרה של הכלכלה.',
  
  'PMI Composite': 'שילוב של PMI הייצור והשירותים. נותן תמונה כוללת של פעילות המגזר הפרטי.',
  
  'Consumer Confidence': 'מדד אמון הצרכן של Conference Board מודד את אופטימיות הצרכנים לגבי הכלכלה. צרכן אופטימי נוטה יותר לקנות ולהוציא, מה שמניע צמיחה.',
  
  'Michigan Sentiment': 'סקר סנטימנט הצרכן של אוניברסיטת מישיגן. כולל גם תחזיות אינפלציה של צרכנים, שעשויות להפוך למציאות אם הציבור מצפה לאינפלציה גבוהה.',
  
  'Business Confidence': 'מדד אמון העסקים מודד את ביטחון מנהלים בכלכלה. ביטחון גבוה מוביל להשקעות והרחבה, ביטחון נמוך מוביל לצמצום.',

  // נדל"ן
  'Housing Starts': 'מספר פרויקטי הבנייה החדשים שהתחילו. נדל"ן מהווה כ-15% מהכלכלה ומניע תעסוקה, מכירות חומרי בניין וריהוט. עליה משקפת ביקוש חזק לדיור.',
  
  'Building Permits': 'מספר היתרי הבנייה שאושרו. מדד מוביל ל-Housing Starts - היתר היום משמעו בנייה בעוד 3-6 חודשים.',
  
  'Existing Home Sales': 'מכירות בתים קיימים משקפות ביקוש לדיור ובריאות שוק הנדל"ן. מהווה את מרבית פעילות הנדל"ן.',
  
  'New Home Sales': 'מכירות בתים חדשים מעידות על ביקוש עתידי ומצב הבנייה. פחות תנודתי מ-Existing Home Sales.',
  
  'NAHB': 'מדד סנטימנט הבונים של איגוד הבנייה הלאומי. מעל 50 משקף תנאים טובים לבנייה, מתחת ל-50 תנאים גרועים.',
  
  'Case-Shiller': 'מדד מחירי הבתים המקיף ביותר בארה"ב. מודד שינויי מחירים ב-20 הערים הגדולות ומשקף את מגמת שוק הנדל"ן.',

  // סחר
  'Trade Balance': 'ההפרש בין יצוא ליבוא. גירעון סחר משמעו יבוא גדול מיצוא, מה שמחליש את הדולר לאורך זמן.',
  
  'Exports': 'ערך הסחורות והשירותים המיוצאים מארה"ב. עליה מחזקת את הדולר ומעידה על ביקוש עולמי חזק למוצרים אמריקאים.',
  
  'Imports': 'ערך הסחורות והשירותים המיובאים לארה"ב. עליה משקפת ביקוש פנימי חזק אך מחלישה את הדולר.',
  
  'Current Account': 'מאזן כל העסקאות הכלכליות עם העולם, כולל סחר, השקעות והעברות. גירעון גדול מעיד על תלות במימון זר.',

  // שווקים
  'VIX': 'מדד התנודתיות של S&P 500, המכונה "מדד הפחד". VIX נמוך מתחת ל-15 משקף שוק רגוע, מעל 25 משקף פחד ופאניקה. ככלל, VIX עולה כאשר מניות יורדות.',
  
  'S&P 500': 'מדד 500 החברות הגדולות בארה"ב. נחשב למדד המרכזי של השוק האמריקאי ומשמש ציון ביצועים לכלל השוק.',
  
  'Dow Jones': 'מדד 30 החברות התעשייתיות המובילות. המדד העתיק ביותר והידוע ביותר, אך פחות מייצג מ-S&P 500.',
  
  'NASDAQ': 'מדד החברות הטכנולוגיות. משקף את ביצועי מגזר הטכנולוגיה והצמיחה.',

  // מטבעות
  'Dollar Index': 'מדד DXY מודד את ערך הדולר מול 6 מטבעות עיקריים. דולר חזק פוגע ביצוא אמריקאי אך מוזיל יבוא ומפחית אינפלציה.',
  
  'USD/EUR': 'שער החליפין דולר-יורו. הזוג הנסחר ביותר בעולם ומשקף את היחס בין שתי הכלכלות הגדולות.',
  
  'USD/JPY': 'שער החליפין דולר-ין יפני. רגיש מאוד למדיניות ריבית ונחשב למדד לסיכון גלובלי.',
  
  'USD/GBP': 'שער החליפין דולר-לירה שטרלינג. משקף את היחס בין הכלכלות האמריקאית והבריטית.',

  // אנרגיה
  'Oil': 'מחיר הנפט משפיע ישירות על עלויות האנרגיה ומהווה מרכיב מרכזי באינפלציה. עליה במחיר הנפט מעלה את CPI ומפעילה לחץ על הפד להעלות ריבית.',
  
  'WTI': 'נפט West Texas Intermediate הוא המדד האמריקאי למחיר נפט גולמי. משמש בסיס לתמחור נפט בצפון אמריקה.',
  
  'Brent': 'נפט Brent הוא המדד העולמי למחיר נפט. משמש בסיס לתמחור כשני שלישים מהנפט בעולם.',

  // בנקים מרכזיים
  'ECB': 'הבנק המרכזי האירופי קובע את מדיניות הריבית באיזור האירו. ריבית גבוהה באירופה מחזקת את היורו ומחלישה את הדולר.',
  
  'BOE': 'בנק אנגליה קובע את ריבית הבסיס בבריטניה. מדיניותו משפיעה על הלירה ועל המשקיעים הגלובליים.',
  
  'BOJ': 'בנק יפן מפעיל מדיניות מוניטרית ייחודית עם ריבית שלילית. שינויי מדיניות יכולים להשפיע על שוקי המט"ח העולמיים.',

  // נוספים
  'Personal Income': 'סך ההכנסות של כל האמריקאים. הכנסה גבוהה מעניקה כוח קנייה ומניעה צריכה וצמיחה.',
  
  'Consumer Spending': 'הוצאות הצרכנים הן המנוע המרכזי של הכלכלה האמריקאית. עליה מעידה על ביטחון צרכנים וכלכלה חזקה.',
  
  'Weekly Economic Index': 'מדד כלכלי שבועי שמשלב נתונים מרובים לתמונה עדכנית של המצב הכלכלי.',

  // ברירת מחדל
  'Default': 'מדד כלכלי המשקף היבט מסוים של בריאות הכלכלה. נתונים חזקים מהצפוי בדרך כלל תומכים בדולר ומפעילים לחץ על מניות בשל חשש להעלאת ריבית. נתונים חלשים מהצפוי עשויים לתמוך במניות אך להחליש את הדולר.'
};

// פונקציה לקבלת הסבר למדד
export function getIndicatorExplanation(title: string, description?: string, category?: string): string {
  const titleLower = title.toLowerCase();
  const descLower = (description || '').toLowerCase();
  const categoryLower = (category || '').toLowerCase();
  
  // חיפוש לפי מילות מפתח
  if (titleLower.includes('fomc') || titleLower.includes('ישיבת הפד') || titleLower.includes('rate decision')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['FOMC'];
  }
  if (titleLower.includes('fed fund') && !titleLower.includes('target')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Fed Funds Rate'];
  }
  if (titleLower.includes('balance sheet') || titleLower.includes('מאזן הפד')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Fed Balance Sheet'];
  }
  if (titleLower.includes('beige book') || titleLower.includes('ביג')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Beige Book'];
  }
  if (titleLower.includes('fomc') && titleLower.includes('minute')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['FOMC Minutes'];
  }
  if (titleLower.includes('fed chair') || titleLower.includes('powell') || titleLower.includes('press conf')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Fed Chair'];
  }
  
  if (titleLower.includes('cpi') && titleLower.includes('core')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Core CPI'];
  }
  if (titleLower.includes('cpi') && titleLower.includes('energy')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['CPI Energy'];
  }
  if (titleLower.includes('cpi') && titleLower.includes('food')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['CPI Food'];
  }
  if (titleLower.includes('cpi')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['CPI'];
  }
  
  if (titleLower.includes('ppi') && titleLower.includes('core')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Core PPI'];
  }
  if (titleLower.includes('ppi')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['PPI'];
  }
  
  if (titleLower.includes('pce') && titleLower.includes('core')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Core PCE'];
  }
  if (titleLower.includes('pce')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['PCE'];
  }
  
  if (titleLower.includes('import price')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Import Price'];
  }
  if (titleLower.includes('export price')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Export Price'];
  }
  
  if (titleLower.includes('nfp') || titleLower.includes('non-farm') || titleLower.includes('payroll')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['NFP'];
  }
  if (titleLower.includes('unemployment') || titleLower.includes('אבטלה')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Unemployment'];
  }
  if (titleLower.includes('jobless') || titleLower.includes('תביעות')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Jobless Claims'];
  }
  if (titleLower.includes('adp')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['ADP'];
  }
  if (titleLower.includes('jolts') || titleLower.includes('job opening')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['JOLTS'];
  }
  if (titleLower.includes('hourly earnings') || titleLower.includes('שכר')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Hourly Earnings'];
  }
  if (titleLower.includes('labor') && titleLower.includes('participation')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Labor Participation'];
  }
  
  if (titleLower.includes('gdp') && titleLower.includes('real')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Real GDP'];
  }
  if (titleLower.includes('gdp') && titleLower.includes('growth')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['GDP Growth'];
  }
  if (titleLower.includes('gdp')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['GDP'];
  }
  
  if (titleLower.includes('retail') && titleLower.includes('ex')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Retail Ex Auto'];
  }
  if (titleLower.includes('retail')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Retail Sales'];
  }
  
  if (titleLower.includes('industrial production')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Industrial Production'];
  }
  if (titleLower.includes('manufacturing production')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Manufacturing'];
  }
  if (titleLower.includes('capacity util')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Capacity Utilization'];
  }
  if (titleLower.includes('inventor')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Business Inventories'];
  }
  if (titleLower.includes('durable goods')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Durable Goods'];
  }
  if (titleLower.includes('factory order')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Factory Orders'];
  }
  if (titleLower.includes('personal consumption') || titleLower.includes('consumer spending')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Personal Consumption'];
  }
  
  if (titleLower.includes('ism') && titleLower.includes('manufacturing')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['ISM Manufacturing'];
  }
  if (titleLower.includes('ism') && titleLower.includes('services')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['ISM Services'];
  }
  if (titleLower.includes('pmi') && titleLower.includes('manufacturing')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['PMI Manufacturing'];
  }
  if (titleLower.includes('pmi') && titleLower.includes('services')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['PMI Services'];
  }
  if (titleLower.includes('pmi') && titleLower.includes('composite')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['PMI Composite'];
  }
  if (titleLower.includes('consumer confidence')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Consumer Confidence'];
  }
  if (titleLower.includes('michigan')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Michigan Sentiment'];
  }
  if (titleLower.includes('business confidence')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Business Confidence'];
  }
  
  if (titleLower.includes('housing start')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Housing Starts'];
  }
  if (titleLower.includes('building permit')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Building Permits'];
  }
  if (titleLower.includes('existing home')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Existing Home Sales'];
  }
  if (titleLower.includes('new home')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['New Home Sales'];
  }
  if (titleLower.includes('nahb')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['NAHB'];
  }
  if (titleLower.includes('case-shiller')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Case-Shiller'];
  }
  
  if (titleLower.includes('trade balance')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Trade Balance'];
  }
  if (titleLower.includes('export') && !titleLower.includes('price')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Exports'];
  }
  if (titleLower.includes('import') && !titleLower.includes('price')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Imports'];
  }
  if (titleLower.includes('current account')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Current Account'];
  }
  
  if (titleLower.includes('vix')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['VIX'];
  }
  if (titleLower.includes('s&p 500')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['S&P 500'];
  }
  if (titleLower.includes('dow jones')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Dow Jones'];
  }
  if (titleLower.includes('nasdaq')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['NASDAQ'];
  }
  
  if (titleLower.includes('dollar index') || titleLower.includes('dxy')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Dollar Index'];
  }
  if (titleLower.includes('eur') || titleLower.includes('euro')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['USD/EUR'];
  }
  if (titleLower.includes('jpy') || titleLower.includes('yen')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['USD/JPY'];
  }
  if (titleLower.includes('gbp') || titleLower.includes('pound')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['USD/GBP'];
  }
  
  if (titleLower.includes('wti') || (titleLower.includes('oil') && titleLower.includes('west'))) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['WTI'];
  }
  if (titleLower.includes('brent')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Brent'];
  }
  if (titleLower.includes('oil') || titleLower.includes('crude') || titleLower.includes('נפט')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Oil'];
  }
  
  if (titleLower.includes('ecb')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['ECB'];
  }
  if (titleLower.includes('boe') || titleLower.includes('bank of england')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['BOE'];
  }
  if (titleLower.includes('boj') || titleLower.includes('bank of japan')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['BOJ'];
  }
  
  if (titleLower.includes('10-year') || titleLower.includes('10 year') || titleLower.includes('10 שנים')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['10-Year Treasury'];
  }
  if (titleLower.includes('2-year') || titleLower.includes('2 year') || titleLower.includes('2 שנים')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['2-Year Treasury'];
  }
  if (titleLower.includes('30-year') || titleLower.includes('30 year')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['30-Year Treasury'];
  }
  if (titleLower.includes('3-month') || titleLower.includes('3 month')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['3-Month Treasury'];
  }
  if (titleLower.includes('yield curve')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Yield Curve'];
  }
  if (titleLower.includes('bank credit')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Bank Credit'];
  }
  
  if (titleLower.includes('personal income')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Personal Income'];
  }
  if (titleLower.includes('weekly economic')) {
    return ECONOMIC_INDICATOR_EXPLANATIONS['Weekly Economic Index'];
  }
  
  return ECONOMIC_INDICATOR_EXPLANATIONS['Default'];
}

// פונקציה לקבלת כותרת נקייה להסבר
export function getIndicatorTitle(title: string): string {
  return title;
}
