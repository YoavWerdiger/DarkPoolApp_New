# 🔔 הגדרת מערכת התראות צ'אט - DarkPool

## 📋 תיאור

מערכת התראות Push לצ'אט בסגנון וואטסאפ:
- התראה על כל הודעה חדשה בקבוצה
- תמיכה בהשתקת קבוצות
- תוכן ההתראה כולל: שם קבוצה, שם שולח, תוכן ההודעה
- ניווט ישיר לצ'אט מהתראה

---

## 🚀 שלבי התקנה

### שלב 1: העלאת Edge Function

```bash
cd /Users/yoavwerdiger/DarkPoolApp_New-1

# העלאת ה-Edge Function
supabase functions deploy send-chat-notification
```

### שלב 2: קבלת Service Role Key

1. היכנס ל-[Supabase Dashboard](https://supabase.com/dashboard)
2. בחר את הפרויקט שלך
3. לך ל: **Project Settings** > **API**
4. העתק את ה-**service_role** (לא את ה-anon!)

### שלב 3: עדכון ה-SQL

1. פתח את הקובץ: `database/setup_chat_notifications.sql`
2. החלף `YOUR_SERVICE_ROLE_KEY` ב-Key האמיתי
3. הרץ את הקובץ ב-Supabase SQL Editor

### שלב 4: בדיקה

הרץ את השאילתה הזו לבדיקה:

```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_chat_message_notification';
```

אם רואים שורה אחת - הכל עובד! ✅

---

## 📱 שימוש באפליקציה

### השתקת קבוצה

```typescript
import { supabase } from '../services/supabase';

// השתקת קבוצה
const muteGroup = async (groupId: string, userId: string) => {
  const { data, error } = await supabase.rpc('toggle_group_mute', {
    p_group_id: groupId,
    p_user_id: userId,
    p_muted: true
  });
  
  return !error;
};

// ביטול השתקה
const unmuteGroup = async (groupId: string, userId: string) => {
  const { data, error } = await supabase.rpc('toggle_group_mute', {
    p_group_id: groupId,
    p_user_id: userId,
    p_muted: false
  });
  
  return !error;
};
```

### טיפול בהתראות נכנסות

```typescript
// App.tsx או navigation file
import * as Notifications from 'expo-notifications';

// טיפול בלחיצה על התראה
Notifications.addNotificationResponseReceivedListener(response => {
  const data = response.notification.request.content.data;
  
  if (data.type === 'chat_message') {
    // ניווט לצ'אט
    navigation.navigate('ChatGroup', {
      groupId: data.group_id,
      groupName: data.group_name,
    });
  }
});
```

---

## 🔧 פתרון בעיות

### התראות לא נשלחות

1. **בדוק שה-Edge Function הועלה:**
   ```bash
   supabase functions list
   ```

2. **בדוק לוגים:**
   ```bash
   supabase functions logs send-chat-notification
   ```

3. **בדוק שה-Trigger פעיל:**
   ```sql
   SELECT * FROM information_schema.triggers 
   WHERE trigger_name = 'trigger_chat_message_notification';
   ```

4. **בדוק pg_net:**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

### שגיאת "net.http_post does not exist"

הרץ:
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Service Role Key לא עובד

ודא שהעתקת את ה-`service_role` ולא את ה-`anon` key.

---

## 📊 מבנה ההתראה

```json
{
  "title": "שם הקבוצה",
  "body": "שם השולח: תוכן ההודעה",
  "data": {
    "type": "chat_message",
    "group_id": "uuid",
    "group_name": "שם הקבוצה",
    "group_avatar": "url",
    "message_id": "uuid",
    "sender_id": "uuid",
    "sender_name": "שם השולח",
    "sender_avatar": "url",
    "message_type": "text|image|video|audio|document",
    "content_preview": "תוכן מקוצר..."
  }
}
```

---

## 📁 קבצים שנוצרו

| קובץ | תיאור |
|------|-------|
| `supabase/functions/send-chat-notification/index.ts` | Edge Function לשליחת התראות |
| `database/setup_chat_notifications.sql` | SQL להגדרת Trigger (להרצה) |
| `database/trigger_chat_notifications.sql` | SQL מלא עם הסברים |
| `CHAT_NOTIFICATIONS_SETUP.md` | קובץ הוראות זה |

---

## ✅ צ'קליסט

- [ ] Edge Function הועלה (`supabase functions deploy send-chat-notification`)
- [ ] Service Role Key הוחלף ב-SQL
- [ ] SQL הורץ ב-Supabase
- [ ] Trigger נוצר בהצלחה
- [ ] בדיקה: שליחת הודעה → התראה מתקבלת

---

**גרסה:** 1.0.0  
**תאריך:** ינואר 2026

