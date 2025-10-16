# 🔑 הגדרת EODHD_API_KEY ב-Supabase

## הבעיה:
השגיאה `EODHD_API_KEY is required` אומרת שה-API Key לא מוגדר ב-Supabase Edge Functions.

## הפתרון:

### שלב 1: מצא את ה-EODHD API Key שלך
1. לך ל: https://eodhistoricaldata.com/cp/pricing
2. התחבר לחשבון שלך
3. העתק את ה-API Key (בדרך כלל מתחיל ב-`demo.` או מספרים)

### שלב 2: הוסף את ה-API Key ל-Supabase
1. לך ל: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/settings/api
2. גלול למטה ל-**"Environment Variables"**
3. לחץ על **"Add new variable"**
4. מלא:
   - **Name**: `EODHD_API_KEY`
   - **Value**: `YOUR_EODHD_API_KEY_HERE` (העתק את ה-API Key שלך)
5. לחץ **"Save"**

### שלב 3: הפרוס מחדש את ה-Edge Function
1. לך ל: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions
2. מצא את `daily-earnings-sync`
3. לחץ על **"Deploy"** או **"Redeploy"**

### שלב 4: בדוק שהכל עובד
```bash
./test_earnings_only.sh
```

---

## 🔍 איך לדעת אם זה עובד:

אם ה-API Key מוגדר נכון, תראה:
```json
{
  "success": true,
  "message": "Earnings synchronized successfully",
  "processed": 50,
  "inserted": 45
}
```

אם לא, תראה:
```json
{
  "success": false,
  "error": "EODHD_API_KEY is required"
}
```

---

## 💡 טיפים:

1. **API Key חינמי**: אם יש לך API Key חינמי, הוא מוגבל ל-20 קריאות ביום
2. **API Key בתשלום**: אם יש לך API Key בתשלום, אין הגבלות
3. **בדיקה**: אפשר לבדוק את ה-API Key עם curl:
   ```bash
   curl "https://eodhd.com/api/calendar/earnings?from=2025-01-01&to=2025-01-07&api_token=YOUR_KEY&fmt=json"
   ```

---

## 🚨 אם עדיין לא עובד:

1. ודא שה-API Key נכון
2. ודא שהפונקציה פרוסה מחדש אחרי הוספת ה-Environment Variable
3. בדוק את ה-logs ב-Supabase Dashboard → Functions → daily-earnings-sync → Logs
