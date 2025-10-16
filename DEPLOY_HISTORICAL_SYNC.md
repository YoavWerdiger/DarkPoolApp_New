# 📊 מדריך: סנכרון דיווחים היסטוריים (3 חודשים אחורה)

## 🎯 מטרה
לעדכן את מסד הנתונים עם דיווחי תוצאות מ-3 חודשים אחורה ועד 3 חודשים קדימה.

---

## 📋 שלבי הביצוע

### שלב 1: פריסת Edge Function מעודכן

```bash
# פריסת הפונקציה המעודכנת
npx supabase functions deploy daily-earnings-sync-major-indices
```

**מה זה עושה?**
- משנה את טווח הזמן מ"מהיום ואילך" ל"3 חודשים אחורה + 3 חודשים קדימה"
- מאפשר לראות גם דיווחים שכבר קרו בחודשים האחרונים

---

### שלב 2: הרצת הסנכרון החד-פעמי

```bash
# הרצת הסקריפט
./sync_historical_earnings.sh
```

**או ידנית:**
```bash
curl -X POST "https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-major-indices" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1MjE4MjAsImV4cCI6MjA1MDA5NzgyMH0.JQwC3xJv8zJQwC3xJv8zJQwC3xJv8zJQwC3xJv8zJ" \
  -H "Content-Type: application/json"
```

---

### שלב 3: בדיקת התוצאות

#### A. בדוק בטרמינל
אם הכל עבד, תראה:
```
✅ הסנכרון הושלם בהצלחה!

📱 עכשיו אפשר לפתוח את האפליקציה ולראות:
   • דיווחים מ-3 חודשים אחורה
   • דיווחים של היום
   • דיווחים עתידיים
```

#### B. בדוק במסד הנתונים
```sql
-- בדוק כמה רשומות נוספו
SELECT 
  COUNT(*) as total_records,
  MIN(report_date) as earliest_report,
  MAX(report_date) as latest_report
FROM earnings_calendar;
```

#### C. בדוק באפליקציה
1. פתח את האפליקציה
2. עבור לטאב "תחזיות"
3. השתמש בחצים לנווט לתאריכים קודמים
4. אמור לראות דיווחים מ-3 החודשים האחרונים

---

## 🔍 פתרון בעיות

### אם הסקריפט נכשל:

#### שגיאה: "Function not found"
```bash
# פרוס את הפונקציה:
npx supabase functions deploy daily-earnings-sync-major-indices
```

#### שגיאה: "EODHD_API_KEY is required"
1. עבור ל-Supabase Dashboard
2. Settings → Edge Functions
3. הוסף `EODHD_API_KEY` = `68e3c3af900997.85677801`

#### שגיאה: "Invalid JWT"
- בדוק שה-Anon Key נכון בסקריפט
- נסה להריץ שוב - לפעמים צריך כמה ניסיונות

#### אין נתונים באפליקציה
```bash
# בדוק את מסד הנתונים:
npx supabase db execute "SELECT COUNT(*) FROM earnings_calendar;"
```

---

## 📊 מה הפונקציה עושה?

1. **מחשבת טווח תאריכים**:
   - מ: 3 חודשים אחורה מהיום
   - עד: 3 חודשים קדימה מהיום

2. **שולפת נתונים מ-EODHD API**:
   - רק מניות מאינדקסים גדולים (S&P 500, NASDAQ, Dow Jones)
   - מעבדת בקבוצות של 50 מניות כדי לא להעמיס

3. **מכניסה למסד נתונים**:
   - משתמשת ב-UPSERT (מעדכנת אם קיים, מכניסה אם לא)
   - מונעת כפילויות

---

## ⏱️ זמן ריצה צפוי

- **מספר מניות**: ~90 מניות מאינדקסים גדולים
- **זמן ריצה**: 30-60 שניות
- **רשומות צפויות**: 200-400 דיווחים (תלוי בתקופה)

---

## ✅ סיכום

אחרי הביצוע המוצלח:
- ✅ Edge Function מעודכן ופרוס
- ✅ מסד הנתונים מכיל 3 חודשים אחורה
- ✅ האפליקציה יכולה להציג דיווחים היסטוריים
- ✅ המשתמש יכול לנווט בין תאריכים ולראות דיווחים עבר

---

## 🔄 עדכונים עתידיים

הפונקציה תרוץ אוטומטית (אם מוגדר cron job) ותמשיך לעדכן:
- כל יום תשלוף דיווחים חדשים
- תמיד תשמור 3 חודשים אחורה + 3 קדימה
- הנתונים יישארו עדכניים

---

**תאריך יצירה**: אוקטובר 2025  
**גרסה**: 1.0

