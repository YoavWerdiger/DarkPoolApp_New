# 🚀 פריסה דרך Supabase Dashboard

## ⚠️ בעיית הרשאות

אם אתה מקבל שגיאה `403: Your account does not have the necessary privileges`, זה אומר שאתה צריך לפרוס דרך Dashboard או שיש לך בעיית הרשאות.

---

## 📋 פריסה דרך Dashboard (מומלץ)

### שלב 1: הגדרת Environment Variable

1. לך ל-Supabase Dashboard:
   ```
   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/settings/functions
   ```

2. גלול למטה ל-**Environment Variables** או **Secrets**

3. לחץ **Add new secret** או **New environment variable**

4. הוסף:
   - **Name:** `BENZINGA_API_KEY`
   - **Value:** `bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC`

5. לחץ **Save**

---

### שלב 2: פריסת Edge Functions

#### פונקציה 1: earnings-daily-update

1. לך ל:
   ```
   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions
   ```

2. אם הפונקציה כבר קיימת:
   - לחץ על `earnings-daily-update`
   - לחץ **Edit** (או ה-icon של עיפרון)

3. אם הפונקציה לא קיימת:
   - לחץ **Create a new function**
   - שם הפונקציה: `earnings-daily-update`

4. העתק את כל התוכן מ:
   ```
   supabase/functions/earnings-daily-update/index.ts
   ```
   או אם Dashboard לא תומך ב-shared files, השתמש ב:
   ```
   DASHBOARD_DEPLOY/earnings-daily-update-standalone.ts
   ```

5. הדבק את הקוד ב-editor

6. לחץ **Deploy** או **Save**

#### פונקציה 2: earnings-results-update

1. לחץ **Create a new function** שוב

2. שם הפונקציה: `earnings-results-update`

3. העתק את כל התוכן מ:
   ```
   supabase/functions/earnings-results-update/index.ts
   ```

4. לחץ **Deploy**

#### פונקציה 3: daily-earnings-sync-simple

1. לחץ **Create a new function** שוב

2. שם הפונקציה: `daily-earnings-sync-simple`

3. העתק את כל התוכן מ:
   ```
   supabase/functions/daily-earnings-sync-simple/index.ts
   ```

4. לחץ **Deploy**

#### פונקציה 4: benzinga-websocket-stream (חדש!)

1. לחץ **Create a new function** שוב

2. שם הפונקציה: `benzinga-websocket-stream`

3. העתק את כל התוכן מ:
   ```
   supabase/functions/benzinga-websocket-stream/index.ts
   ```

4. לחץ **Deploy**

---

### ⚠️ חשוב: עדכון פונקציות קיימות

אם הפונקציות כבר קיימות, צריך לעדכן אותן:

1. לך ל-Edge Functions list
2. לחץ על הפונקציה שעדיין לא עודכנה
3. לחץ **Edit**
4. העתק את הקוד החדש מ-`supabase/functions/[שם-הפונקציה]/index.ts`
5. לחץ **Save** או **Deploy**

---

## 📝 העתקת Shared Files

אם יש `_shared` files, צריך לוודא שהן קיימות. במידה וצריך:

1. ל-`earnings-utils.ts` - הקוד כבר כולל את ה-import
2. ה-edge functions מחפשים את הקובץ ב-`../_shared/earnings-utils.ts`

**אם Dashboard לא תומך ב-_shared files:**
- העתק את תוכן `earnings-utils.ts` ישירות לכל function
- או השתמש ב-inline functions

---

## ✅ בדיקה שהפריסה הצליחה

### דרך Dashboard:

1. לך ל-Edge Functions
2. ודא שכל ה-4 פונקציות מופיעות
3. Status צריך להיות "Active"

### בדיקה ידנית:

```bash
# בדיקת earnings-daily-update
curl -X POST \
  https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-daily-update \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

---

## 🔧 פתרון בעיות

### פונקציה לא עובדת?

1. **בדוק את ה-Logs:**
   - לך ל-Edge Functions → בחר פונקציה → Logs
   - חפש שגיאות

2. **ודא שה-Environment Variable הוגדר:**
   - Settings → Edge Functions → Secrets
   - ודא ש-`BENZINGA_API_KEY` קיים

3. **בדוק את הקוד:**
   - ודא שהעתקת את כל הקוד
   - ודא שאין syntax errors

---

## 📚 קבצים לפריסה

רשימת הקבצים שצריך להעתיק:

1. ✅ `supabase/functions/earnings-daily-update/index.ts`
2. ✅ `supabase/functions/earnings-results-update/index.ts`
3. ✅ `supabase/functions/daily-earnings-sync-simple/index.ts`
4. ✅ `supabase/functions/benzinga-websocket-stream/index.ts`
5. ✅ `supabase/functions/_shared/earnings-utils.ts` (אם Dashboard תומך)

---

## 🎯 סיכום

**מה צריך לעשות:**
1. ✅ הגדר `BENZINGA_API_KEY` ב-Settings → Secrets
2. ✅ פרוס/עדכן את 4 ה-Edge Functions דרך Dashboard
3. ✅ בדוק שהכל עובד דרך Logs

**למה Dashboard ולא CLI?**
- אין בעיית הרשאות
- יותר קל למתחילים
- תמיכה מלאה בכל הפיצ'רים

---

## 💡 טיפים

- שמור backup של הקוד הקיים לפני עדכון
- בדוק את ה-Logs אחרי כל פריסה
- התחל עם פונקציה אחת לפני שתפרוס את כולן

