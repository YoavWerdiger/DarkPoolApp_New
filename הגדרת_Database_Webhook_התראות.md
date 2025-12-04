# הגדרת Database Webhook להתראות Push

## 🎯 איך זה עובד:

1. **Trigger** - כשנוספת חדשה ל-`app_news`, ה-trigger שומר התראות ב-`pending_notifications`
2. **Database Webhook** - Supabase מזהה שינוי ב-`pending_notifications` וקורא אוטומטית ל-Edge Function
3. **Edge Function** - `process-pending-notifications` שולח את ההתראות דרך Expo Push API

---

## 📋 שלבים להגדרה:

### שלב 1: הרצת SQL Scripts

הרץ את ה-SQL scripts ב-Supabase Dashboard > SQL Editor:

1. `create_device_tokens_table.sql`
2. `create_news_notification_trigger.sql`

### שלב 2: הגדרת Database Webhook

1. **היכנס ל-Supabase Dashboard**
2. **עבור ל-Database > Webhooks** (או Database > Database > Webhooks)
3. **לחץ על "Create a new webhook"**

4. **מלא את הפרטים:**
   - **Name**: `send-news-notifications`
   - **Table**: `pending_notifications`
   - **Events**: בחר `INSERT` בלבד
   - **Type**: `HTTP Request`
   - **Method**: `POST`
   - **URL**: 
     ```
     https://wpmrtczbfcijoocguime.supabase.co/functions/v1/process-pending-notifications
     ```
   - **HTTP Headers**:
     ```json
     {
       "Content-Type": "application/json",
       "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"
     }
     ```
     **חשוב**: החלף `YOUR_SERVICE_ROLE_KEY` ב-Service Role Key שלך (מצאת ב-Settings > API)

5. **Body Template** (אופציונלי - אם תרצה לשלוח מידע ספציפי):
   ```json
   {
     "table": "pending_notifications",
     "type": "INSERT",
     "record": {
       "id": "{{record.id}}",
       "user_id": "{{record.user_id}}",
       "title": "{{record.title}}",
       "body": "{{record.body}}",
       "data": {{record.data}},
       "notification_type": "{{record.notification_type}}",
       "article_id": "{{record.article_id}}"
     }
   }
   ```

6. **לחץ על "Save"**

---

## 🔧 איך למצוא את ה-Service Role Key:

1. Supabase Dashboard > Settings (⚙️) > API
2. תחת "Project API keys" תמצא:
   - `anon` `public` - זה לא זה
   - `service_role` `secret` - זה מה שאתה צריך! ⚠️ **זה סודי - אל תחלוק אותו**

---

## ✅ בדיקה:

1. **הוסף חדשה חדשה** ל-`app_news` (דרך Supabase או דרך האפליקציה)
2. **בדוק ב-`pending_notifications`** - אמור לראות התראות חדשות
3. **בדוק ב-Logs של Edge Functions** - אמור לראות קריאה ל-`process-pending-notifications`
4. **בדוק שההתראות נשלחו** - אמור לראות ב-logs `✅ Sent X/Y notifications`

---

## 🆚 יתרונות על פני Cron Job:

✅ **מיידי** - התראות נשלחות מיד כשנוספת חדשה  
✅ **אוטומטי** - לא צריך להגדיר schedule  
✅ **יעיל** - לא בודק כל 5 דקות, רק כשצריך  
✅ **פשוט** - הגדרה אחת ב-Dashboard  

---

## 🔄 אם Webhook לא עובד:

אפשר להשתמש ב-pg_net extension (דורש הפעלה):

```sql
-- הפעלת pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- עדכון הפונקציה לשימוש ב-pg_net
-- (ראה create_news_notification_trigger.sql - יש שם פונקציה send_news_notification_immediately)
```

אבל **Database Webhook הוא הפתרון המומלץ** - יותר פשוט ולא דורש extensions.

---

## 📝 הערות:

- ה-Webhook יקרא ל-`process-pending-notifications` **לכל INSERT** ב-`pending_notifications`
- ה-Edge Function מטפלת בכמה התראות בבת אחת (עד 100)
- אם יש שגיאה, ההתראות יישארו ב-`pending_notifications` עם `is_sent = false`







