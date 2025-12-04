# 🚀 הוראות פריסה ידנית - Benzinga API

## שלב 1: התקנת Supabase CLI

### אפשרות א': דרך Homebrew (מומלץ למק)
```bash
brew install supabase/tap/supabase
```

### אפשרות ב': הורדה ישירה
```bash
# macOS (Intel)
curl -L https://github.com/supabase/cli/releases/latest/download/supabase_darwin_amd64.tar.gz | tar xz
sudo mv supabase /usr/local/bin/

# macOS (Apple Silicon)
curl -L https://github.com/supabase/cli/releases/latest/download/supabase_darwin_arm64.tar.gz | tar xz
sudo mv supabase /usr/local/bin/
```

### אפשרות ג': דרך Docker
```bash
docker pull supabase/cli:latest
alias supabase='docker run --rm -it supabase/cli:latest'
```

**בדיקה שההתקנה עבדה:**
```bash
supabase --version
```

---

## שלב 2: התחברות ל-Supabase

```bash
# התחבר (יפתח דפדפן לאימות)
supabase login

# בדוק חיבור
supabase projects list
```

---

## שלב 3: חיבור לפרויקט

```bash
cd /Users/yoavwerdiger/DarkPoolApp_New-1

# מצא את ה-project reference שלך
supabase projects list

# התחבר לפרויקט (החלף את [YOUR_PROJECT_REF])
supabase link --project-ref [YOUR_PROJECT_REF]
```

---

## שלב 4: הגדרת API Key

```bash
supabase secrets set BENZINGA_API_KEY=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC
```

---

## שלב 5: יצירת טבלאות במסד נתונים

### אפשרות א': דרך Supabase Dashboard (קל יותר)

1. עבור ל: https://supabase.com/dashboard
2. בחר בפרויקט שלך
3. לחץ על **SQL Editor** בתפריט השמאלי
4. לחץ על **New Query**
5. העתק והדבק את התוכן של: `database/benzinga_economic_events_table.sql`
6. לחץ **Run** או `Cmd+Enter`

### אפשרות ב': דרך CLI

```bash
# קבל את ה-Database URL
supabase status

# הרץ את הסקריפט
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -f database/benzinga_economic_events_table.sql
```

---

## שלב 6: פריסת Edge Functions

```bash
# וודא שאתה בתיקיית הפרויקט
cd /Users/yoavwerdiger/DarkPoolApp_New-1

# פרוס את כל ה-Functions
supabase functions deploy daily-earnings-sync-simple
supabase functions deploy benzinga-economics-sync
supabase functions deploy economic-scheduler
```

**או השתמש בסקריפט:**
```bash
chmod +x deploy_benzinga.sh
./deploy_benzinga.sh
```

---

## שלב 7: הגדרת Cron Jobs

1. עבור ל: https://supabase.com/dashboard
2. בחר בפרויקט שלך
3. לחץ על **Database** → **Cron Jobs**
4. לחץ **Create a new cron job**

### Job #1: Earnings Sync (פעמיים ביום)

**Name:** `daily-earnings-sync`  
**Schedule:** `0 6,18 * * *`  
**Query:**
```sql
SELECT net.http_post(
  url := 'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/daily-earnings-sync-simple',
  headers := '{"Authorization": "Bearer [YOUR_ANON_KEY]"}'::jsonb,
  body := '{}'::jsonb
);
```

### Job #2: Economic Calendar Sync (כל 6 שעות)

**Name:** `benzinga-economics-sync`  
**Schedule:** `0 */6 * * *`  
**Query:**
```sql
SELECT net.http_post(
  url := 'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/benzinga-economics-sync',
  headers := '{"Authorization": "Bearer [YOUR_ANON_KEY]"}'::jsonb,
  body := '{}'::jsonb
);
```

**💡 איפה למצוא את הערכים:**
- `[YOUR_PROJECT_REF]` - ב-Dashboard Settings → General → Reference ID
- `[YOUR_ANON_KEY]` - ב-Dashboard Settings → API → Project API keys → anon/public

---

## שלב 8: בדיקה ראשונית

### בדיקה מהטרמינל:

```bash
# קבל את ה-URLs וה-Keys מ:
supabase status

# בדוק Earnings Sync
curl -X POST \
  'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/daily-earnings-sync-simple' \
  -H 'Authorization: Bearer [YOUR_ANON_KEY]' \
  -H 'Content-Type: application/json'

# בדוק Economics Sync
curl -X POST \
  'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/benzinga-economics-sync' \
  -H 'Authorization: Bearer [YOUR_ANON_KEY]' \
  -H 'Content-Type: application/json'
```

### צפה בלוגים:

```bash
# לוגים של Economics
supabase functions logs benzinga-economics-sync --tail

# לוגים של Earnings
supabase functions logs daily-earnings-sync-simple --tail
```

### בדוק נתונים במסד נתונים:

```sql
-- עבור ל-SQL Editor ב-Dashboard והרץ:

-- בדוק Earnings
SELECT COUNT(*) FROM earnings_calendar;
SELECT * FROM earnings_calendar ORDER BY report_date DESC LIMIT 5;

-- בדוק Economic Events
SELECT COUNT(*) FROM economic_events_cache WHERE source = 'Benzinga';
SELECT * FROM economic_events_cache WHERE source = 'Benzinga' ORDER BY date DESC LIMIT 5;

-- בדוק Metadata
SELECT * FROM economic_cache_metadata;
```

---

## ✅ Checklist סופי

- [ ] Supabase CLI מותקן
- [ ] מחובר ל-Supabase (`supabase login`)
- [ ] הפרויקט מחובר (`supabase link`)
- [ ] API Key הוגדר (`BENZINGA_API_KEY`)
- [ ] טבלאות נוצרו (דרך SQL Editor)
- [ ] 3 Edge Functions נפרסו
- [ ] 2 Cron Jobs מוגדרים
- [ ] בוצעה בדיקה ראשונית
- [ ] יש נתונים בטבלאות

---

## 🆘 פתרון בעיות

### "command not found: supabase"
**פתרון:** התקן את Supabase CLI (ראה שלב 1)

### "Not logged in"
**פתרון:**
```bash
supabase login
```

### "Project not linked"
**פתרון:**
```bash
supabase link --project-ref [YOUR_PROJECT_REF]
```

### "401 Unauthorized" בבדיקות
**פתרון:** בדוק ש-ANON_KEY נכון:
```bash
supabase status
```

### "Table does not exist"
**פתרון:** הרץ את `database/benzinga_economic_events_table.sql` דרך SQL Editor

---

## 📋 סיכום מהיר

```bash
# התקנה
brew install supabase/tap/supabase

# חיבור
supabase login
supabase link --project-ref [YOUR_REF]

# הגדרה
supabase secrets set BENZINGA_API_KEY=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC

# פריסה
./deploy_benzinga.sh

# בדיקה
supabase functions logs benzinga-economics-sync
```

---

## 🎯 הצעד הבא

לאחר שכל השלבים הושלמו:
1. פתח את האפליקציה
2. עבור למסך **חדשות**
3. בדוק **דיווחי תוצאות** ו-**יומן כלכלי**
4. וודא שיש נתונים עדכניים

---

**בהצלחה! 🚀**

אם יש בעיות, תמיד אפשר לבדוק:
- [README_BENZINGA.md](README_BENZINGA.md)
- [BENZINGA_SETUP_GUIDE.md](BENZINGA_SETUP_GUIDE.md)

