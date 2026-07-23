# 🧹 ניקוי והרצה חדשה - daily-economic-sync-simple

## ✅ מה עשינו:

הוספנו **תרגום לעברית** גם ל-`daily-economic-sync-simple`!

עכשיו שתי הפונקציות כוללות תרגום:
- ✅ `daily-economic-sync-simple` - עם תרגום
- ✅ `sync-economic-calendar` - עם תרגום

---

## 📋 מה לעשות עכשיו:

### שלב 1: עדכן את הפונקציה ב-Supabase

1. **לך ל-Supabase Dashboard** → **Edge Functions**
2. **בחר `daily-economic-sync-simple`**
3. **העתק את הקוד המעודכן מ:** `supabase/functions/daily-economic-sync-simple/index.ts`
4. **הדבק ב-Supabase**
5. **פרוס**

---

### שלב 2: נקה את הטבלה

**הרץ את הקוד הזה ב-SQL Editor:**

```sql
-- מחיקת כל האירועים הישנים
DELETE FROM economic_events;

-- בדיקה
SELECT COUNT(*) FROM economic_events;
```

---

### שלב 3: הרץ את הפונקציה עכשיו

1. **לך ל-Edge Functions** → **`daily-economic-sync-simple`**
2. **לחץ "Invoke"** או **"Test"**
3. **חכה שהפונקציה תרוץ** (30-60 שניות)
4. **בדוק את הלוגים:**
   - צריך לראות: `📅 Event: "Event Name" → "תרגום לעברית"`
   - צריך לראות: `✅ Saved to DB`

---

### שלב 4: בדוק את התוצאות

```sql
-- כמה אירועים יש?
SELECT COUNT(*) FROM economic_events;

-- דוגמה לאירועים עם תרגום
SELECT title, date, time, importance
FROM economic_events
ORDER BY date DESC
LIMIT 10;
```

**צריך לראות:**
- ✅ כותרות בעברית (למשל: "📊 CPI - מדד מחירים לצרכן")
- ✅ תאריכים נכונים
- ✅ שעות נכונות

---

## ✨ זה הכל!

עכשיו `daily-economic-sync-simple` כוללת:
- ✅ תיקון תאריכים ושעות
- ✅ תרגום לעברית
- ✅ פריסה נכונה לימים

**הפונקציה תרוץ אוטומטית כל יום ב-06:00** (לפי ה-Cron Job שכבר יצרת). 🎉


