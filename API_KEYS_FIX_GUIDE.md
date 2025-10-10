# מדריך תיקון מפתחות API 🔧

## בעיות זוהו ❌

### 1. **EODHD API - שגיאות 402/403**
- **מפתח נוכחי**: `68c99499978585.44924748` → שגיאת 403 (Forbidden)
- **מפתח חלופי**: `68e3c3af900997.85677801` → שגיאת 402 (Payment Required)

### 2. **FRED API - שגיאת 403**
- **מפתח נוכחי**: `f4d63bd9fddd00b175c1c99ca49b4247` → Access Denied

## פתרונות 🛠️

### פתרון 1: קבלת מפתח EODHD חדש

1. **הירשם/התחבר** ל-[EODHD](https://eodhd.com)
2. **עבור ל-Dashboard** → API Keys
3. **צור מפתח חדש** או בדוק את המפתח הקיים
4. **החלף בקובץ** `services/eodhdService.ts`:
   ```typescript
   this.apiKey = process.env.EXPO_PUBLIC_EODHD_API_KEY || 'YOUR_NEW_API_KEY_HERE';
   ```

### פתרון 2: קבלת מפתח FRED חדש

1. **הירשם** ל-[FRED API](https://fred.stlouisfed.org/docs/api/api_key.html)
2. **קבל מפתח API** חינמי
3. **החלף בקובץ** `services/economicCalendarService.ts`:
   ```typescript
   const FRED_API_KEY = 'YOUR_NEW_FRED_API_KEY';
   ```

### פתרון 3: הגדרת משתני סביבה

צור קובץ `.env` בשורש הפרויקט:
```bash
EXPO_PUBLIC_EODHD_API_KEY=your_eodhd_api_key_here
EXPO_PUBLIC_FRED_API_KEY=your_fred_api_key_here
```

## מצב זמני 🚧

כרגע המערכת מוגדרת להציג **נתונים לדוגמה** במקרה של כשל ב-API:

### דיווחי רווחים לדוגמה:
- **Apple Inc.** (AAPL.US) - היום
- **Microsoft Corporation** (MSFT.US) - מחר  
- **Alphabet Inc.** (GOOGL.US) - מחרתיים
- **Tesla Inc.** (TSLA.US) - היום

### סימנים ויזואליים:
- 🏷️ "(נתונים לדוגמה)" בכותרת
- 🔧 "מצב תחזוקה" בהודעות
- ⚠️ צבעי אזהרה

## בדיקת תיקון ✅

לאחר החלפת המפתחות:

1. **הפעל מחדש** את האפליקציה
2. **בדוק את הלוגים** - אמור להיעלם:
   ```
   ❌ EODHD API: 403 Forbidden
   ❌ FRED API error: HTTP 403
   ```
3. **ודא שהנתונים אמיתיים** - לא יופיע "(נתונים לדוגמה)"

## תמיכה 📞

אם הבעיה נמשכת:
- בדוק את תוקף המפתחות
- ודא שהמפתחות פעילים
- פנה לתמיכת הלקוחות של EODHD/FRED

---
*עדכון אחרון: 7 באוקטובר 2025*


