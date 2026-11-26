# 🔔 מדריך התראות דיווחי Earnings

## 📋 סקירה כללית

מערכת התראות אוטומטית לדיווחי רווחים (Earnings Reports) ששולחת התראות למשתמשים:
1. **התראות לפני דיווח** - 15 דקות לפני פרסום הדיווח
2. **התראות על תוצאות** - כשהתוצאות מתפרסמות

## 🚀 התקנה

### 1. פריסת Edge Functions

```bash
# פריסת פונקציה לדיווחים קרובים
npm run supabase:deploy:earnings-notifications

# פריסת פונקציה לתוצאות שפורסמו
npm run supabase:deploy:earnings-results-notifications
```

### 2. יצירת Database Trigger

הרץ את הקובץ `database/create_earnings_notifications_trigger.sql` ב-Supabase SQL Editor.

זה יוצר trigger שיקרא ל-Edge Function **אוטומטית** כשמתעדכנת רשומה ב-`earnings_calendar` עם תוצאה חדשה.

### 3. יצירת Cron Job (רק לדיווחים קרובים)

הרץ את הקובץ `database/create_earnings_notifications_cron.sql` ב-Supabase SQL Editor.

זה יוצר cron job אחד:
- **earnings_notifications_upcoming** - רץ כל 5 דקות, בודק דיווחים ב-15 דקות הקרובות

**הערה:** התראות על תוצאות נשלחות דרך database trigger (לא cron), כך שהן נשלחות **מיידית** כשהתוצאות מתפרסמות.

## 📱 איך זה עובד

### התראות לפני דיווח

1. Cron job רץ כל 5 דקות
2. בודק דיווחים של היום שעדיין לא פורסמו (`actual IS NULL`)
3. בודק אם הדיווח ב-15 דקות הקרובות
4. בודק משתמשים עם `earnings_notifications = true`
5. יוצר התראות ב-`pending_notifications`
6. `process-pending-notifications` שולח את ההתראות

**דוגמה להתראה:**
```
📊 דיווח רווחים לפני פתיחה
Apple Inc. (AAPL) - דיווח לפני פתיחה בעוד 12 דקות
```

### התראות על תוצאות

1. **Database Trigger** מזהה עדכון ב-`earnings_calendar` עם תוצאה חדשה
2. ה-trigger קורא ל-Edge Function **מיידית** עם הנתונים של הרשומה
3. הפונקציה בודקת משתמשים עם `earnings_notifications = true`
4. יוצרת התראות ב-`pending_notifications` עם פרטי ההפתעה
5. `process-pending-notifications` שולח את ההתראות

**יתרון:** התראות נשלחות **מיידית** כשהתוצאות מתפרסמות, לא צריך לחכות ל-cron job!

**דוגמה להתראה:**
```
🚀 תוצאות דיווח רווחים
Apple Inc. (AAPL) - תוצאות פורסמו - EPS הפתעה חיובית של 8.5%
```

## ⚙️ הגדרות משתמש

ההתראות נשלחות רק למשתמשים עם:
- `notifications_enabled = true`
- `earnings_notifications = true`

ההגדרות נשמרות ב-`user_notification_settings` וניתן לשנות אותן במסך ההגדרות.

## 🧪 בדיקה

### הפעלה ידנית

הרץ את הקובץ `database/test_earnings_notifications.sql` ב-Supabase SQL Editor.

### בדיקת לוגים

**דיווחים קרובים:**
https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions/earnings-notifications/logs

**תוצאות שפורסמו:**
https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions/earnings-results-notifications/logs

### בדיקת התראות שנוצרו

```sql
SELECT 
  id,
  user_id,
  title,
  body,
  is_sent,
  created_at
FROM pending_notifications
WHERE notification_type = 'earnings'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

## 📊 סינון

ההתראות נשלחות רק עבור:
- דיווחים עם `importance >= 3`
- דיווחים של `.US` (שוק אמריקאי)
- דיווחים של היום (`report_date = TODAY`)

## 🔧 תחזוקה

### הסרת Cron Job

```sql
SELECT cron.unschedule('earnings_notifications_upcoming');
```

### הסרת Database Trigger

```sql
DROP TRIGGER earnings_notification_trigger ON earnings_calendar;
DROP FUNCTION trigger_earnings_results_notification() CASCADE;
```

### בדיקת סטטוס Cron Job

```sql
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname = 'earnings_notifications_upcoming';
```

### בדיקת Database Trigger

```sql
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'earnings_notification_trigger';
```

## 📝 הערות

- **התראות לפני דיווח:** נשלחות רק ב-15 דקות הקרובות (דרך cron job כל 5 דקות)
- **התראות על תוצאות:** נשלחות **מיידית** דרך database trigger כשמתעדכנת רשומה
- ההתראות נשלחות רק פעם אחת לכל דיווח (בודק אם כבר יש התראה ב-30 דקות האחרונות)
- ההתראות עוברות דרך `process-pending-notifications` שכבר בודק את ההגדרות של המשתמש
- ה-trigger פועל רק על עדכונים של `actual` או `revenue_actual` (לא על עדכונים אחרים)

## 🎯 שיפורים עתידיים

- [ ] הוספת watchlist - התראות רק לחברות מסוימות
- [ ] התראות על הפתעות גדולות בלבד (למשל >10%)
- [ ] התראות מותאמות אישית לפי העדפות משתמש
- [ ] התראות על דיווחים של מחר (עם אפשרות להגדיר מראש)





