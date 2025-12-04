# 🔐 הגדרת BENZINGA_API_KEY Secret

## שלב 1: לך ל-Supabase Dashboard

1. פתח: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/settings/functions

2. גלול למטה ל-**Secrets** או **Environment Variables**

3. לחץ **Add new secret** או **New environment variable**

## שלב 2: הוסף את ה-Secret

**Name:** `BENZINGA_API_KEY`

**Value:** `bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC`

לחץ **Save**

---

## ✅ איך לבדוק שה-Secret הוגדר

לך ל-Edge Functions → בחר פונקציה → Logs

אם יש שגיאה של "Missing BENZINGA_API_KEY" - ה-Secret לא הוגדר.

אם הפונקציה עובדת - ה-Secret הוגדר נכון!

---

## 📝 הערות

- ה-Secret צריך להיות ב-Settings → Edge Functions → Secrets
- כל ה-Edge Functions ישתמשו ב-Secret הזה אוטומטית
- אחרי הוספת ה-Secret, עדכן את הפונקציות כדי שיעשו restart


