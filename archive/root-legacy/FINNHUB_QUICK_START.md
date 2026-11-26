# התחלה מהירה עם Finnhub 🚀

## בדקה אחת - איך להתחיל? ⚡

### 1. פתח את האפליקציה
```bash
npm start
# או
expo start
```

### 2. עבור ליומן כלכלי
```
📱 App → 📰 חדשות → 📅 יומן כלכלי
```

### 3. בחר "Finnhub 🔥"
לחץ על הכפתור הראשון בחלק העליון של המסך

### זהו! 🎉
הנתונים מ-Finnhub אמורים להיטען אוטומטית

---

## פרטי ה-API שבשימוש

```
API Key: <FINNHUB_API_KEY>
Base URL: https://finnhub.io/api/v1
```

---

## שימוש בקוד - הדוגמה הפשוטה ביותר

```typescript
import FinnhubService from './services/finnhubService';

// קבלת אירועים
const events = await FinnhubService.getUpcomingWeekEvents();

// זהו!
console.log(events);
```

---

## מה אפשר לעשות?

### 📅 יומן כלכלי
```typescript
// שבוע הבא
await FinnhubService.getUpcomingWeekEvents();

// חודש הבא
await FinnhubService.getUpcomingMonthEvents();

// רק חשובים
await FinnhubService.getHighImportanceEvents(30);
```

### 📰 חדשות
```typescript
// חדשות שוק
await FinnhubService.getMarketNews('general');

// חדשות חברה
await FinnhubService.getCompanyNews('AAPL', '2024-01-01', '2024-12-31');
```

---

## בעיות נפוצות

### ❌ לא רואה נתונים?
1. בדוק אינטרנט
2. המתן 5 שניות
3. לחץ "רענן"

### ❌ שגיאת 429?
```
המתן דקה - חרגת ממגבלת ה-API
```

### ❌ השירות לא עובד?
```
עבור ל-EODHD או FRED דרך המתג
```

---

## קבצים חשובים

```
📁 services/
  └── finnhubService.ts          ← השירות הראשי

📁 screens/News/
  └── EconomicCalendarTab.tsx    ← המסך שמשתמש בשירות

📄 FINNHUB_INTEGRATION_README.md  ← מדריך מלא
📄 FINNHUB_EXAMPLES.ts            ← 10 דוגמאות שימוש
```

---

## תמיכה

💬 יש בעיה? יצרת קשר עם התמיכה של Finnhub:
- 🌐 https://finnhub.io/support
- 📧 support@finnhub.io

---

**זה הכל! תהנה מהנתונים 🎉**


