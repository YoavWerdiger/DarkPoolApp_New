# אינטגרציה עם EODHD API - מדריך שימוש

## סקירה כללית

המערכת שודרגה כדי לתמוך ב-API של EODHD (EOD Historical Data) לצד FRED API הקיים, מה שמאפשר גישה למגוון רחב יותר של מדדים כלכליים ואירועים.

## תכונות חדשות

### 🎯 מדדים כלכליים נתמכים

המערכת תומכת כעת במדדים הבאים:

#### מדדי מחירים
- **CPI** - Consumer Price Index (מדד המחירים לצרכן)
- **PPI** - Producer Price Index (מדד מחירי יצרן)
- **Core CPI** - Core Consumer Price Index
- **Core PPI** - Core Producer Price Index

#### מדדי תעסוקה
- **NFP** - Non-Farm Payrolls (תעסוקה לא-חקלאית)
- **Unemployment Rate** - שיעור אבטלה
- **Jobless Claims** - תביעות אבטלה
- **Average Hourly Earnings** - שכר ממוצע לשעה

#### מדדי ייצור ותעשייה
- **PMI Manufacturing** - מדד מנהלי רכש תעשייתי
- **PMI Services** - מדד מנהלי רכש שירותים
- **ISM Manufacturing** - מדד ISM תעשייתי
- **Industrial Production** - ייצור תעשייתי

#### מדדי צריכה וקמעונאות
- **Retail Sales** - מכירות קמעונאיות
- **Consumer Spending** - הוצאות צרכנים
- **PCE** - Personal Consumption Expenditures
- **Core PCE** - Core PCE

#### מדדי נדל"ן
- **Existing Home Sales** - מכירות בתים קיימים
- **New Home Sales** - מכירות בתים חדשים
- **Housing Starts** - התחלות בנייה
- **Building Permits** - רישיונות בנייה

#### מדדי ריבית ומדיניות מוניטרית
- **Fed Funds Rate** - ריבית פדרל ריזרב
- **Interest Rate Decision** - החלטות ריבית
- **FOMC Meeting** - ישיבות FOMC

#### מדדי GDP וצמיחה
- **GDP** - תמ"ג
- **GDP Growth** - צמיחת תמ"ג
- **Real GDP** - תמ"ג ריאלי

### 🌍 מדינות נתמכות

- **US** - ארצות הברית
- **EU** - האיחוד האירופי
- **UK** - בריטניה
- **JP** - יפן
- **CA** - קנדה
- **AU** - אוסטרליה
- **CH** - שוויץ
- **CN** - סין
- **DE** - גרמניה
- **FR** - צרפת
- **IT** - איטליה
- **ES** - ספרד
- **IL** - ישראל

## שימוש במערכת

### 1. בחירת מקור נתונים

המערכת מאפשרת לבחור בין שני מקורות נתונים:

- **EODHD (מתקדם)** - נתונים מקיפים יותר עם מדדים נוספים
- **FRED (בסיסי)** - נתונים בסיסיים מ-Federal Reserve

### 2. פילטרים מתקדמים

#### בחירת מדינה
- לחץ על "פילטרים מתקדמים"
- בחר מדינה מהרשימה
- המערכת תטען אירועים כלכליים עבור המדינה הנבחרת

#### בחירת מדד כלכלי
- בחר מדד ספציפי מהרשימה
- המערכת תציג רק אירועים הקשורים למדד הנבחר
- אפשרות לבחור "הכל" לתצוגת כל המדדים

### 3. טעינת נתונים היסטוריים

כאשר משתמשים ב-EODHD API:
- כפתור "טען נתונים היסטוריים נוספים" מופיע בתחתית המסך
- לחיצה על הכפתור טוענת 3 חודשים נוספים של נתונים היסטוריים
- התהליך ממשיך עד שלא נותרו עוד נתונים

### 4. ניווט יומי

- חצים לניווט בין ימים
- כפתור "חזור להיום" לחזרה לתאריך הנוכחי
- תצוגת אירועים עבור תאריך ספציפי

## הגדרת API Key

כדי להשתמש ב-EODHD API, יש להגדיר את המפתח בסביבת הפיתוח:

```bash
# ב-.env או בקובץ הגדרות
EXPO_PUBLIC_EODHD_API_KEY=your_api_key_here
```

## מבנה הקוד

### קבצים חדשים

1. **`services/eodhdService.ts`** - שירות EODHD עם כל הפונקציונליות
2. **`EODHD_INTEGRATION_README.md`** - מדריך זה

### קבצים מעודכנים

1. **`screens/News/EconomicCalendarTab.tsx`** - ממשק משתמש משופר
2. **`services/economicCalendarService.ts`** - טיפוסים מעודכנים

## API Endpoints

### Economic Events API
```
GET https://eodhd.com/api/economic-events
```

פרמטרים:
- `country` - קוד מדינה (US, EU, UK, וכו')
- `type` - סוג אירוע (CPI, NFP, GDP, וכו')
- `from` - תאריך התחלה (YYYY-MM-DD)
- `to` - תאריך סיום (YYYY-MM-DD)
- `importance` - רמת חשיבות (high, medium, low)
- `limit` - מספר תוצאות (ברירת מחדל: 100)
- `offset` - דילוג (עבור pagination)

### Macro Indicators API
```
GET https://eodhd.com/api/macroeconomic
```

פרמטרים:
- `country` - קוד מדינה (Alpha-3: USA, FRA, וכו')
- `indicator` - מדד ספציפי
- `from` - תאריך התחלה
- `to` - תאריך סיום
- `limit` - מספר תוצאות
- `offset` - דילוג

## דוגמאות שימוש

### טעינת אירועים כלכליים
```typescript
import EODHDService from '../services/eodhdService';

// טעינת אירועים פופולריים
const events = await EODHDService.getPopularEconomicIndicators('US');

// טעינת אירועים ספציפיים
const cpiEvents = await EODHDService.getEconomicEvents({
  country: 'US',
  type: 'CPI',
  from: '2024-01-01',
  to: '2024-12-31',
  importance: 'high'
});
```

### טעינת מדדים מאקרו
```typescript
// טעינת מדדי GDP
const gdpData = await EODHDService.getMacroIndicators({
  country: 'USA',
  indicator: 'gdp_current_usd',
  from: '2020-01-01',
  to: '2024-12-31'
});
```

## טיפים לשימוש

1. **בחירת מקור נתונים**: EODHD מומלץ למשתמשים מתקדמים, FRED למשתמשים בסיסיים
2. **פילטרים**: השתמש בפילטרים כדי להתמקד במדדים החשובים לך
3. **נתונים היסטוריים**: טען נתונים היסטוריים כדי לראות מגמות ארוכות טווח
4. **ביצועים**: המערכת משתמשת ב-caching כדי לשפר ביצועים

## פתרון בעיות

### API לא זמין
אם EODHD API לא זמין, המערכת תחזור אוטומטית ל-FRED API.

### נתונים חסרים
אם לא מופיעים מספיק אירועים, נסה:
1. לשנות מדינה
2. לבחור "הכל" במדדים
3. לטעון נתונים היסטוריים נוספים

### שגיאות רשת
המערכת תציג הודעת שגיאה ותאפשר רענון הנתונים.

## תמיכה

לשאלות או בעיות, פנה לצוות הפיתוח או בדוק את הלוגים בקונסול לפירוט נוסף.


