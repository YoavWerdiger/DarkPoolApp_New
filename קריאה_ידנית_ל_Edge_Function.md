# 📱 קריאה ידנית ל-Edge Function לשליחת התראות

## ✅ המצב הנוכחי:
- ✅ ההתראה נוצרה ב-`pending_notifications`
- ⏳ `is_sent = false` - עדיין לא נשלחה
- ✅ יש device token פעיל

---

## 🚀 איך לשלוח את ההתראות:

### אופציה 1: דרך Supabase Dashboard (הכי פשוט)

1. **לך ל-Supabase Dashboard**
2. **עבור ל-Edge Functions**
3. **בחר `process-pending-notifications`**
4. **לחץ על "Invoke"**
5. **השאר body ריק: `{}`**
6. **לחץ על "Invoke Function"**

זה ישלח את כל ההתראות הממתינות!

---

### אופציה 2: דרך HTTP Request (curl)

```bash
curl -X POST \
  'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/process-pending-notifications' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwNzM1MSwiZXhwIjoyMDY2NzgzMzUxfQ.waqI1C-t6gthSCf8jP1v_gFRRVhhvaIcQG0effqsA1A' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

---

### אופציה 3: דרך Supabase SQL (pg_net)

```sql
-- קריאה ל-Edge Function דרך pg_net
SELECT net.http_post(
  url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/process-pending-notifications',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwNzM1MSwiZXhwIjoyMDY2NzgzMzUxfQ.waqI1C-t6gthSCf8jP1v_gFRRVhhvaIcQG0effqsA1A'
  ),
  body := '{}'::jsonb
);
```

---

## 🔍 אחרי שליחה - בדיקה:

```sql
-- בדוק אם ההתראות נשלחו
SELECT 
  pn.id,
  pn.user_id,
  pn.title,
  pn.is_sent,
  pn.sent_at,
  pn.created_at,
  u.email
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.id = '4098566d-3433-42a4-8146-c28ecca77f69';
```

אמור לראות:
- ✅ `is_sent = true`
- ✅ `sent_at` עם תאריך

---

## 📝 הערות:

1. **ה-trigger עובד!** ✅ - ההתראות נוצרות
2. **ה-Edge Function לא נקראה אוטומטית** - צריך לקרוא לה ידנית
3. **אפשר להגדיר Cron Job** - שיקרא ל-Edge Function כל X דקות

---

## 🎯 המלצה:

**השתמש באופציה 1** (דרך Dashboard) - הכי פשוט ומהיר!

לך ל-Edge Functions > `process-pending-notifications` > Invoke ולחץ על "Invoke Function".


