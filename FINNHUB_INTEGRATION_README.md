# שילוב Finnhub API ביומן הכלכלי 🔥

## סקירה כללית

שילבנו בהצלחה את **Finnhub API** כמקור נתונים ליומן הכלכלי באפליקציה. Finnhub מספק נתונים כלכליים בזמן אמת מסביב לעולם.

---

## פרטי התחברות

### API Key
```
d1uf6gpr01qpci1cbg00d1uf6gpr01qpci1cbg0g
```

### Base URL
```
https://finnhub.io/api/v1
```

### WebSocket URL (לעתיד - עדכונים בזמן אמת)
```
wss://ws.finnhub.io?token=d1uf6gpr01qpci1cbg00d1uf6gpr01qpci1cbg0g
```

### Secret (לWebhooks)
```
d1uf6gpr01qpci1cbg1g
```

---

## מה עשינו?

### 1. יצרנו שירות חדש: `finnhubService.ts`

השירות כולל:

✅ **Economic Calendar** - יומן אירועים כלכליים
- `getEconomicCalendar(from?, to?)` - שליפת אירועים לטווח תאריכים
- `getUpcomingWeekEvents()` - אירועים לשבוע הקרוב
- `getUpcomingMonthEvents()` - אירועים לחודש הקרוב
- `getHighImportanceEvents(days)` - רק אירועים בעלי חשיבות גבוהה

✅ **Market News** - חדשות שוק
- `getMarketNews(category, minId)` - חדשות כלליות
- `getCompanyNews(symbol, from, to)` - חדשות חברה ספציפית

✅ **כלים נוספים**
- `convertToAppFormat(event)` - המרה אוטומטית לפורמט של האפליקציה
- `checkApiAvailability()` - בדיקת זמינות ה-API
- Cache מובנה למהירות

### 2. שילוב ביומן הכלכלי

עדכנו את `EconomicCalendarTab.tsx` עם:

🎛️ **מתג בחירת מקור נתונים**
- Finnhub 🔥 (ברירת מחדל)
- EODHD
- FRED

🔄 **נפילה אוטומטית (Fallback)**
- אם Finnhub ריק, המערכת עוברת אוטומטית ל-EODHD
- אם גם EODHD לא זמין, עוברת ל-FRED

---

## איך להשתמש?

### באפליקציה

1. **פתח את מסך החדשות** 📰
2. **עבור ללשונית "יומן כלכלי"** 📅
3. **בחר מקור נתונים בחלק העליון:**
   - לחץ על **"Finnhub 🔥"** לנתוני Finnhub
   - לחץ על **"EODHD"** לנתוני EODHD
   - לחץ על **"FRED"** לנתוני FRED

4. **הנתונים יטענו אוטומטית!**

### בקוד (שימוש פרוגרמטי)

```typescript
import FinnhubService from '../services/finnhubService';

// קבלת אירועים לחודש הקרוב
const events = await FinnhubService.getUpcomingMonthEvents();

// קבלת אירועים בעלי חשיבות גבוהה בלבד
const highImpact = await FinnhubService.getHighImportanceEvents(30);

// קבלת חדשות שוק
const news = await FinnhubService.getMarketNews('general');

// בדיקת זמינות API
const isAvailable = await FinnhubService.checkApiAvailability();
```

---

## תכונות ייחודיות של Finnhub

### 🌍 כיסוי גלובלי
Finnhub מספק נתונים כלכליים עבור מדינות רבות:
- 🇺🇸 ארצות הברית
- 🇪🇺 גוש האירו
- 🇬🇧 בריטניה
- 🇯🇵 יפן
- 🇨🇦 קנדה
- 🇦🇺 אוסטרליה
- 🇨🇭 שוויץ
- 🇨🇳 סין
- 🇮🇱 ישראל
- ועוד...

### 📊 סוגי אירועים

השירות מזהה ומסווג אוטומטית את האירועים לקטגוריות:

| קטגוריה | דוגמאות |
|---------|----------|
| 🌱 צמיחה | GDP, GDP Growth, Real GDP |
| 💸 אינפלציה | CPI, PPI, Inflation, Price Index |
| 👥 תעסוקה | Employment, Unemployment, Jobs, Payrolls |
| 🛒 צריכה | Retail Sales, Consumer Spending |
| 💰 ריבית | Interest Rate, Fed Rate, FOMC |
| 🏭 תעשייה | Manufacturing, Industrial Production |
| 🌐 סחר | Trade Balance, Exports, Imports |
| 🏠 נדל"ן | Housing, Home Sales, Building Permits |

### 🎯 רמות חשיבות

כל אירוע מסווג לפי רמת חשיבות:
- **🔴 High** - חשיבות גבוהה (משפיע מאוד על השוק)
- **🟡 Medium** - חשיבות בינונית
- **🟢 Low** - חשיבות נמוכה

---

## טיפים לשימוש

### 1️⃣ **החלף בין מקורות נתונים**
נסה מקורות שונים כדי לקבל תמונה מלאה:
- Finnhub - מצוין לאירועים עתידיים
- EODHD - טוב למדדים פופולריים
- FRED - מעולה לנתונים היסטוריים

### 2️⃣ **סנן לפי חשיבות**
השתמש בכפתורי הסינון כדי להתמקד באירועים החשובים ביותר

### 3️⃣ **נווט בין תאריכים**
השתמש בחצים לניווט בין ימים ובכפתור "חזור להיום"

### 4️⃣ **רענן את הנתונים**
משוך מטה (Pull to Refresh) כדי לטעון נתונים עדכניים

---

## מבנה הנתונים

כל אירוע כלכלי כולל:

```typescript
{
  id: string;              // מזהה ייחודי
  title: string;           // שם האירוע (למשל "US GDP Growth")
  country: string;         // מדינה (בעברית)
  currency: string;        // מטבע (USD, EUR, וכו')
  importance: 'high' | 'medium' | 'low';  // רמת חשיבות
  date: string;            // תאריך (YYYY-MM-DD)
  time: string;            // שעה (HH:MM)
  actual?: string;         // תוצאה בפועל
  forecast?: string;       // תחזית
  previous?: string;       // ערך קודם
  description?: string;    // תיאור
  category?: string;       // קטגוריה (צמיחה, אינפלציה, וכו')
  source: 'Finnhub';      // מקור הנתונים
  unit?: string;           // יחידת מדידה
}
```

---

## מגבלות API

### Free Plan
- 60 API calls לדקה
- 30 API calls לשנייה
- גישה ליומן כלכלי
- גישה לחדשות שוק בסיסיות

### אם נחרג מהמגבלה
- המערכת תחזיר status 429 (Rate Limit Exceeded)
- יש מנגנון fallback אוטומטי ל-EODHD

---

## Cache ואופטימיזציה

השירות כולל cache מובנה:
- ⏱️ **זמן Cache**: 5 דקות
- 💾 **גודל Cache**: אוטומטי
- 🔄 **רענון אוטומטי**: כשה-cache פג תוקף

```typescript
// ניקוי ידני של ה-cache
FinnhubService.clearCache();

// בדיקת סטטיסטיקות cache
const stats = FinnhubService.getCacheStats();
console.log(`Cache size: ${stats.size} items`);
```

---

## פתרון בעיות נפוצות

### ❌ לא רואה נתונים
1. בדוק חיבור לאינטרנט
2. בדוק שה-API Key תקין
3. נסה להחליף למקור נתונים אחר
4. לחץ על "רענן נתונים"

### ❌ השירות איטי
1. Cache אמור לפתור את זה
2. בדוק אם לא חרגת ממגבלת ה-API
3. נסה להפעיל מחדש את האפליקציה

### ❌ שגיאות API
```
Error: Finnhub API Error: 429 Rate limit exceeded
```
**פתרון:** המתן דקה והשירות יעבור אוטומטית ל-EODHD

---

## תכונות עתידיות (TODO)

- [ ] 🔔 התראות על אירועים חשובים
- [ ] 📈 גרפים של נתונים כלכליים
- [ ] 🔄 WebSocket לעדכונים בזמן אמת
- [ ] 📱 Push Notifications
- [ ] 🌍 סינון לפי מדינה
- [ ] 📊 השוואה בין תחזית לתוצאה
- [ ] 💾 שמירת אירועים למועדפים

---

## קישורים שימושיים

📚 [Finnhub API Documentation](https://finnhub.io/docs/api)

🔑 [Dashboard שלך](https://finnhub.io/dashboard)

💬 [תמיכה](https://finnhub.io/support)

---

## סיכום

שילבנו בהצלחה את Finnhub API ביומן הכלכלי! 🎉

המשתמשים עכשיו יכולים:
✅ לבחור בין 3 מקורות נתונים איכותיים
✅ לקבל אירועים כלכליים עדכניים מכל העולם
✅ לסנן לפי חשיבות וקטגוריה
✅ לנווט בקלות בין תאריכים
✅ ליהנות ממערכת fallback אוטומטית

**תהנה מהיומן הכלכלי המשודרג! 🚀**

---

_עודכן לאחרונה: ${new Date().toLocaleDateString('he-IL')}_


