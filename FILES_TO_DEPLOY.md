# 📋 רשימת קבצים לפריסה - מעבר ל-Benziga API

## ✅ קבצים מוכנים לפריסה

### 1. earnings-daily-update
**מיקום:** `supabase/functions/earnings-daily-update/index.ts`
**סטטוס:** ✅ עודכן לשימוש ב-Benziga API
**שימוש:** עדכון יומי של דיווחי רווחים עם תוצאות בפועל

### 2. earnings-results-update  
**מיקום:** `supabase/functions/earnings-results-update/index.ts`
**סטטוס:** ✅ עודכן לשימוש ב-Benziga API
**שימוש:** עדכון תוצאות למניות גדולות (50 מניות במקביל)

### 3. daily-earnings-sync-simple
**מיקום:** `supabase/functions/daily-earnings-sync-simple/index.ts`
**סטטוס:** ✅ עודכן לשימוש ב-Benziga API
**שימוש:** סינכרון כללי של earnings (שבוע אחורה + 3 חודשים קדימה)

### 4. benzinga-websocket-stream (חדש!)
**מיקום:** `supabase/functions/benzinga-websocket-stream/index.ts`
**סטטוס:** ✅ מוכן לפריסה
**שימוש:** WebSocket stream לעדכונים בזמן אמת

---

## 📝 הוראות פריסה

### ⚠️ חשוב: Dashboard לא תומך ב-Shared Files!

השתמש בגרסאות **standalone** מה-`DASHBOARD_DEPLOY/` folder!

### שלב 1: הגדר Environment Variable

ב-Supabase Dashboard → Settings → Edge Functions → Secrets:

**Name:** `BENZINGA_API_KEY`  
**Value:** `bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC`

### שלב 2: פרוס את הפונקציות

לך ל: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions

עבור על כל פונקציה:
1. לחץ על שם הפונקציה (או צור חדשה אם לא קיימת)
2. לחץ **Edit**
3. **העתק את הקוד מהקובץ ה-standalone המתאים:**
   - `DASHBOARD_DEPLOY/earnings-daily-update-standalone.ts`
   - `DASHBOARD_DEPLOY/earnings-results-update-standalone.ts`
   - `DASHBOARD_DEPLOY/daily-earnings-sync-simple-standalone.ts`
   - `DASHBOARD_DEPLOY/benzinga-websocket-stream-standalone.ts`
4. הדבק ב-editor (העתק את כל הקוד!)
5. לחץ **Save** או **Deploy**

---

## 🔄 שינויים עיקריים

כל הקבצים עכשיו:
- ✅ משתמשים ב-`BENZINGA_API_KEY` במקום `EODHD_API_KEY`
- ✅ קוראים ל-`https://api.benzinga.com/api/v2/calendar/earnings`
- ✅ ממירים את הפורמט של Benzinga לפורמט תואם EODHD (לתאימות עם הקוד הקיים)
- ✅ מקור ברירת מחדל: `Benzinga` (מוגדר ב-`earnings-utils.ts`)

---

## ⚠️ הערות

- הקבצים האחרים (כמו `daily-economic-sync-simple`) עדיין משתמשים ב-EODHD - זה בסדר כי הם לא קשורים ל-earnings
- ההמרה ל-"פורמט EODHD" היא רק הערה - הקוד עובד עם Benzinga אבל שומר על תאימות עם המבנה הקיים
- כל הפונקציות תומכות ב-shared file: `_shared/earnings-utils.ts`

---

## ✅ בדיקה

לאחר הפריסה, בדוק את ה-Logs:
1. לך ל-Edge Functions → בחר פונקציה → Logs
2. חפש הודעות כמו: `📡 Calling Benzinga API...`
3. ודא שאין שגיאות 401 (API key לא תקין)

