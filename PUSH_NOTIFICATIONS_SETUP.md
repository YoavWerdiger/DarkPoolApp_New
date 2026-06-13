# הגדרת התראות Push לחדשות

## שלבים להפעלת המערכת:

### 1. יצירת טבלאות ב-Supabase

הרץ את ה-SQL הבא ב-Supabase SQL Editor:

```sql
-- טבלת device tokens
-- הרץ את: create_device_tokens_table.sql

-- טבלת pending notifications ו-trigger
-- הרץ את: create_news_notification_trigger.sql
```

### 2. הגדרת Edge Functions

העלה את ה-Edge Functions הבאים ל-Supabase:

1. **send-push-notification** - שליחת התראות למשתמשים ספציפיים
2. **process-pending-notifications** - עיבוד התראות ממתינות

```bash
# העלאה דרך Supabase CLI
supabase functions deploy send-push-notification
supabase functions deploy process-pending-notifications
```

### 3. הגדרת Cron Job (אופציונלי)

אם תרצה לשלוח התראות דרך cron job במקום trigger ישיר:

1. היכנס ל-Supabase Dashboard
2. עבור ל-Edge Functions > Cron Jobs
3. הוסף cron job חדש:
  - **Function**: `process-pending-notifications`
  - **Schedule**: `*/5 `* * * * (כל 5 דקות)
  - **Method**: POST

### 4. הגדרת Expo Project ID

ה-Projects ID כבר מוגדר ב-`app.json`:

```json
"extra": {
  "eas": {
    "projectId": "c6140546-bf96-4ca0-85a5-26807f0742f6"
  }
}
```

### 5. הרשאות

המערכת מבקשת הרשאות אוטומטית כשהמשתמש נכנס.

## איך זה עובד:

1. **רישום מכשירים**: כשמשתמש נכנס, ה-device token נרשם אוטומטית ב-`device_tokens`
2. **חדשה חדשה**: כשנוספת חדשה ל-`app_news`, trigger יוצר רשומה ב-`pending_notifications`
3. **שליחת התראות**:
  - דרך trigger: קורא ל-`send-push-notification` ישירות
  - דרך cron: `process-pending-notifications` מטפל בהתראות ממתינות

## בדיקת הגדרות משתמש

המערכת בודקת את ההגדרות מ-`AsyncStorage`:

- `newsNotifications`: האם להפעיל התראות חדשות
- `notifications`: האם להפעיל התראות כלליות

## הערות חשובות:

1. **Expo Push Notifications**: המערכת משתמשת ב-Expo Push Notifications API
2. **Production**: לוודא שה-Projects ID נכון ב-production
3. **Testing**: ניתן לבדוק עם `NotificationService.sendLocalNotification()`

## פתרון בעיות:

- **אין התראות**: בדוק שה-device token נרשם ב-`device_tokens`
- **התראות לא נשלחות**: בדוק את ה-logs של Edge Functions
- **הרשאות**: ודא שהמשתמש נתן הרשאות להתראות

