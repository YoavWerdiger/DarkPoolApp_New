# הגדרת n8n להתראות Push

## 🎯 איך זה עובד:

1. **Trigger** - כשנוספת חדשה ל-`app_news`, ה-trigger שומר התראות ב-`pending_notifications`
2. **n8n Workflow** - n8n מזהה שינוי ב-`pending_notifications` וקורא ל-Edge Function
3. **Edge Function** - `process-pending-notifications` שולח את ההתראות דרך Expo Push API

---

## 📋 שלבים להגדרה:

### שלב 1: הרצת SQL Scripts

הרץ את ה-SQL scripts ב-Supabase Dashboard > SQL Editor:

1. `create_device_tokens_table.sql`
2. `create_news_notification_trigger.sql`

### שלב 2: הגדרת n8n Workflow

#### אפשרות 1: Supabase Trigger (מומלץ - מיידי)

1. **פתח n8n**
2. **צור Workflow חדש**
3. **הוסף Node מסוג "Supabase Trigger"**:
   - **Connection**: התחבר ל-Supabase שלך
     - **Host**: `wpmrtczbfcijoocguime.supabase.co`
     - **Database**: `postgres`
     - **User**: `postgres`
     - **Password**: (מצאת ב-Supabase Dashboard > Settings > Database)
   - **Table**: `pending_notifications`
   - **Event**: `INSERT`
   - **Schema**: `public`

4. **הוסף Node מסוג "HTTP Request"**:
   - **Method**: `POST`
   - **URL**: 
     ```
     https://wpmrtczbfcijoocguime.supabase.co/functions/v1/process-pending-notifications
     ```
   - **Authentication**: `Generic Credential Type`
     - **Name**: `Supabase Service Role`
     - **Value**: `Bearer YOUR_SERVICE_ROLE_KEY`
   - **Headers**:
     ```json
     {
       "Content-Type": "application/json"
     }
     ```
   - **Body**: (אופציונלי - אם תרצה לשלוח מידע ספציפי)
     ```json
     {}
     ```
     או השאר ריק - ה-Edge Function יקח את ההתראות ישירות מה-DB

5. **חבר את ה-Nodes**:
   ```
   Supabase Trigger → HTTP Request
   ```

6. **שמור ופעיל את ה-Workflow**

---

#### אפשרות 2: Schedule + SQL Query (פשוט יותר, אבל לא מיידי)

1. **פתח n8n**
2. **צור Workflow חדש**
3. **הוסף Node מסוג "Schedule Trigger"**:
   - **Trigger Times**: `Every 1 minute` (או `Every 5 minutes`)
   - **Timezone**: `Asia/Jerusalem`

4. **הוסף Node מסוג "Supabase"** (או "Postgres"):
   - **Operation**: `Execute Query`
   - **Query**:
     ```sql
     SELECT * FROM public.pending_notifications 
     WHERE is_sent = false 
     ORDER BY created_at ASC 
     LIMIT 100;
     ```

5. **הוסף Node מסוג "IF"** (אופציונלי):
   - **Condition**: `{{ $json.length > 0 }}`
   - אם יש התראות, המשך

6. **הוסף Node מסוג "HTTP Request"**:
   - **Method**: `POST`
   - **URL**: 
     ```
     https://wpmrtczbfcijoocguime.supabase.co/functions/v1/process-pending-notifications
     ```
   - **Authentication**: `Generic Credential Type`
     - **Name**: `Supabase Service Role`
     - **Value**: `Bearer YOUR_SERVICE_ROLE_KEY`
   - **Headers**:
     ```json
     {
       "Content-Type": "application/json"
     }
     ```
   - **Body**: `{}`

7. **חבר את ה-Nodes**:
   ```
   Schedule Trigger → Supabase Query → IF → HTTP Request
   ```

8. **שמור ופעיל את ה-Workflow**

---

## 🔧 איך למצוא את ה-Service Role Key:

1. Supabase Dashboard > Settings (⚙️) > API
2. תחת "Project API keys" תמצא:
   - `service_role` `secret` - זה מה שאתה צריך! ⚠️ **זה סודי - אל תחלוק אותו**

---

## 🔧 איך למצוא את Database Password:

1. Supabase Dashboard > Settings (⚙️) > Database
2. תחת "Connection string" או "Database password"
3. אם אין, לחץ על "Reset database password"

---

## ✅ בדיקה:

1. **הוסף חדשה חדשה** ל-`app_news` (דרך Supabase או דרך האפליקציה)
2. **בדוק ב-`pending_notifications`** - אמור לראות התראות חדשות
3. **בדוק ב-n8n** - אמור לראות שהעבודה רצה
4. **בדוק ב-Logs של Edge Functions** - אמור לראות קריאה ל-`process-pending-notifications`
5. **בדוק שההתראות נשלחו** - אמור לראות ב-logs `✅ Sent X/Y notifications`

---

## 🆚 איזה אפשרות לבחור:

### Supabase Trigger (אפשרות 1):
✅ **מיידי** - התראות נשלחות מיד  
✅ **יעיל** - לא בודק כל הזמן, רק כשצריך  
⚠️ דורש Supabase Trigger node ב-n8n (אם יש)

### Schedule + SQL Query (אפשרות 2):
✅ **פשוט** - עובד תמיד  
✅ **אמין** - לא תלוי ב-triggers  
⚠️ לא מיידי - בודק כל X דקות  
⚠️ פחות יעיל - בודק גם כשאין התראות

**המלצה**: נסה קודם אפשרות 1, אם לא עובד - השתמש באפשרות 2.

---

## 📝 הערות:

- ה-Edge Function `process-pending-notifications` כבר מטפלת בכמה התראות בבת אחת (עד 100)
- אם יש שגיאה, ההתראות יישארו ב-`pending_notifications` עם `is_sent = false`
- אפשר להוסיף error handling ב-n8n לשליחת התראות על שגיאות

---

## 🔄 אם n8n לא עובד:

אפשר תמיד להשתמש ב-Cron Job של Supabase (אם יש):
- Supabase Dashboard > Edge Functions > Cron Jobs
- Function: `process-pending-notifications`
- Schedule: `*/5 * * * *` (כל 5 דקות)







