# 🚀 מדריך פריסה - מעבר ל-Benziga API

## 📋 סקירה כללית

מדריך זה מסביר איך לפרוס את כל ה-edge functions המעודכנים לשימוש ב-Benziga API במקום EODHD.

## ✅ מה עודכן

### Edge Functions שעודכנו:
1. **earnings-daily-update** - עדכון יומי של דיווחי רווחים
2. **earnings-results-update** - עדכון תוצאות למניות גדולות
3. **daily-earnings-sync-simple** - סינכרון כללי של earnings

### Edge Functions חדשים:
4. **benzinga-websocket-stream** - WebSocket stream לעדכונים בזמן אמת

---

## 🛠️ פריסה אוטומטית (מומלץ)

### שלב 1: הרצת הסקריפט

```bash
./deploy_benzinga_earnings.sh
```

הסקריפט יבצע:
- ✅ בדיקת דרישות קדם
- ✅ התחברות ל-Supabase
- ✅ פריסת כל ה-edge functions
- ✅ סיכום והמלצות

---

## 🛠️ פריסה ידנית

### שלב 1: הכנה

```bash
# ודא ש-Supabase CLI מותקן
npm install -g supabase

# התחבר ל-Supabase
npx supabase login

# קישור לפרויקט
npx supabase link --project-ref wpmrtczbfcijoocguime
```

### שלב 2: הגדרת Environment Variable

הוסף את מפתח ה-API של Benzinga:

```bash
npx supabase secrets set BENZINGA_API_KEY=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC --project-ref wpmrtczbfcijoocguime
```

או דרך Supabase Dashboard:
1. לך ל: **Settings → Edge Functions → Secrets**
2. לחץ **Add new secret**
3. שם: `BENZINGA_API_KEY`
4. ערך: `bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC`
5. לחץ **Save**

### שלב 3: פריסת Edge Functions

```bash
# 1. earnings-daily-update
npx supabase functions deploy earnings-daily-update --project-ref wpmrtczbfcijoocguime

# 2. earnings-results-update
npx supabase functions deploy earnings-results-update --project-ref wpmrtczbfcijoocguime

# 3. daily-earnings-sync-simple
npx supabase functions deploy daily-earnings-sync-simple --project-ref wpmrtczbfcijoocguime

# 4. benzinga-websocket-stream (חדש!)
npx supabase functions deploy benzinga-websocket-stream --project-ref wpmrtczbfcijoocguime
```

---

## 🔍 בדיקה שהפריסה הצליחה

### דרך Supabase Dashboard:

1. לך ל: **Edge Functions**
2. ודא שכל ה-4 פונקציות מופיעות ברשימה
3. בדוק שה-Status הוא "Active"

### דרך Terminal:

```bash
npx supabase functions list --project-ref wpmrtczbfcijoocguime
```

---

## 🧪 בדיקת הפונקציות

### 1. בדיקת earnings-daily-update:

```bash
curl -X POST \
  https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-daily-update \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### 2. בדיקת earnings-results-update:

```bash
curl -X POST \
  https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-results-update \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### 3. בדיקת benzinga-websocket-stream:

```bash
curl -X POST \
  https://wpmrtczbfcijoocguime.supabase.co/functions/v1/benzinga-websocket-stream \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

---

## 📊 עדכון n8n Workflows

אם יש לך workflows ב-n8n שקוראים ל-edge functions האלה, הם ימשיכו לעבוד ללא שינוי כי ה-URLs נשארו זהים.

**חשוב:** ודא ש-n8n לא משתמש ב-EODHD_API_KEY עוד - כל הפונקציות עכשיו משתמשות ב-BENZINGA_API_KEY.

---

## ⚠️ בעיות נפוצות

### שגיאה: "Missing BENZINGA_API_KEY"

**פתרון:** ודא שה-Environment Variable הוגדר:
```bash
npx supabase secrets list --project-ref wpmrtczbfcijoocguime
```

אם חסר, הוסף:
```bash
npx supabase secrets set BENZINGA_API_KEY=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC --project-ref wpmrtczbfcijoocguime
```

### שגיאה: "401 Unauthorized" מ-Benziga

**פתרון:** בדוק שהמפתח API נכון:
- מפתח: `bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC`
- ודא שלא חסרים רווחים או תווים מיוחדים

### הפונקציות לא מתעדכנות

**פתרון:** 
1. בדוק את ה-logs ב-Supabase Dashboard
2. ודא שה-Cron jobs או n8n workflows עדיין פועלים
3. בדוק שה-URLs נכונים

---

## 📚 קבצים רלוונטיים

- `services/benzingaService.ts` - השירות הראשי ל-Benziga API
- `services/eodhdService.ts` - עודכן להשתמש ב-Benziga ל-earnings
- `supabase/functions/_shared/earnings-utils.ts` - עודכן source ל-"Benzinga"
- `BENZINGA_WEBSOCKET_SETUP.md` - מדריך להגדרת WebSocket stream

---

## ✅ סיכום

לאחר הפריסה:
- ✅ כל ה-earnings calendar ישתמש ב-Benziga API
- ✅ עדכונים בזמן אמת (לא יום אחרי!)
- ✅ WebSocket stream לעדכונים מיידיים
- ✅ תאימות מלאה עם הקוד הקיים

🎉 **מעבר מוצלח מ-EODHD ל-Benziga!**










