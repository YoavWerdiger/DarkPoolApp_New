# תיקון התראות Push – כלום לא נשלח

אם ההתראות לא מגיעות בפועל, עברו לפי הסדר:

---

## 1. EXPO_ACCESS_TOKEN (חובה לפרודקשן)

**בלי טוקן זה, Expo לא ישלח התראות לבילדים של production.**

- היכנסו ל-[Expo Dashboard](https://expo.dev) → Account → Access Tokens.
- צרו Access Token (או השתמשו בקיים).
- ב-Supabase: **Project Settings → Edge Functions → Secrets** (או Dashboard → Edge Functions → בחרו פונקציה → Secrets).
- הוסיפו: `EXPO_ACCESS_TOKEN` = הערך של הטוקן שיצרתם.
- יש להגדיר את אותו סוד לכל הפונקציות הרלוונטיות, או ב-Secrets הגלובליים של הפרויקט:
  - `send-push-notification`
  - `process-pending-notifications`
  - `send-chat-notification`

אחרי הוספת הטוקן – ערכו שוב בדיקה (חדשה / הודעה בצ'אט).

---

## 2. רישום מכשיר (device_tokens)

האפליקציה חייבת לרשום את ה-Expo Push Token ב-Supabase.

- וודאו שהמשתמש **מחובר** ושהוא **אישר הרשאות התראות** במכשיר.
- ב-Supabase SQL Editor הרצו:

```sql
SELECT id, user_id, LEFT(expo_push_token, 40) AS token_preview, is_active, platform, updated_at
FROM device_tokens
WHERE is_active = true
ORDER BY updated_at DESC
LIMIT 20;
```

- אם אין שורות או שאין טוקן למשתמש שאתם בודקים – ההתראות לא יכולות להישלח אליו.
- פתרון: פתחו את האפליקציה במכשיר פיזי (לא אמולטור), התחברו, ואפשרו התראות. אם יש מסך הגדרות התראות – היכנסו אליו כדי לכפות רישום מחדש.

---

## 3. טריגרים ו-pg_net (חדשות וצ'אט)

### צ'אט

- התראות צ'אט נשלחות על ידי טריגר על `chat_messages` שקורא ל-`send-chat-notification`.
- וודאו ש-pg_net מופעל והטריגר קיים:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'chat_messages'
  AND trigger_name LIKE '%notification%';
```

- אם הטריגר לא קיים – הרצו את `database/setup_chat_notifications.sql` (כולל החלפת ה-Service Role Key אם צריך).

### חדשות (pending_notifications)

- כשנכנסת חדשה ל-`app_news_clean`, טריגר אמור להכניס שורות ל-`pending_notifications` ולקרוא ל-`process-pending-notifications`.
- אם הקריאה מ-pg_net נכשלת, ההתראות נשארות ב-pending ולא נשלחות.
- **פתרון גיבוי:** הרצת Cron שיריץ את `process-pending-notifications` כל 2 דקות:

```bash
# ב-Supabase SQL Editor הרצו:
```

הקובץ: `database/create_process_pending_notifications_cron.sql`

- לפני ההרצה – אם עשיתם רוטציה ל-Service Role Key, עדכנו את ה-Bearer token בתוך הקובץ (אותו מפתח כמו ב-`setup_chat_notifications.sql`).

---

## 4. בדיקה ידנית

### שליחת התראה ישירה (לפי user_id)

ב-Supabase Dashboard → Edge Functions → `send-push-notification` → Invoke, body לדוגמה:

```json
{
  "userIds": ["UUID-של-משתמש-כאן"],
  "title": "בדיקה",
  "body": "התראה לבדיקה"
}
```

### עיבוד התראות ממתינות

- Edge Functions → `process-pending-notifications` → Invoke עם body: `{}`.
- או הרצת ה-Cron שיצרנו (אחרי שהגדרתם אותו).

---

## 5. לוגים

- **Supabase:** Dashboard → Edge Functions → בחרו פונקציה → Logs.
- חפשו:
  - `❌ EXPO_ACCESS_TOKEN is not set` – צריך להוסיף טוקן (שלב 1).
  - `No active device tokens` – אין טוקנים למשתמש (שלב 2).
  - `Expo Push API error:` – השגיאה המלאה של Expo (לעתים קרובות קשורה לטוקן או ל-credentials).

---

## סיכום צעדים מומלצים

1. להוסיף **EXPO_ACCESS_TOKEN** ב-Supabase Edge Functions Secrets.
2. לוודא שיש **device_tokens** פעילים (משתמש מחובר + הרשאות במכשיר).
3. להריץ את **create_process_pending_notifications_cron.sql** כ-Cron גיבוי לחדשות.
4. לבדוק **לוגים** של הפונקציות אחרי שליחת בדיקה.

אחרי ביצוע כל השלבים – אם עדיין לא נשלח כלום, העתיקו מה-Logs (כולל הודעות Expo) ונוכל לדייק את הבעיה.
