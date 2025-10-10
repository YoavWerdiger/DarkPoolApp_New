# 🔍 רשימת בדיקות לדיבוג Realtime

## בדיקה 1: האם הרצת את ה-SQL? ✋

1. פתח את Supabase Dashboard
2. עבור ל-**SQL Editor**
3. הרץ את `enable_realtime_messages.sql`
4. בדוק שאין שגיאות אדומות

### איך לדעת שזה עבד?
אתה תראה הודעה ירוקה "Success. No rows returned"

---

## בדיקה 2: האם הפעלת Realtime ב-Dashboard? 🔌

1. פתח את Supabase Dashboard
2. לך ל-**Database** → **Replication** (בתפריט השמאלי)
3. תחת "Tables", מצא את `messages`
4. ודא שהמתג **Enable Realtime** מופעל (ירוק)

### איך זה צריך להיראות?
```
Tables:
  ☑️ messages          [Enable Realtime: ON]
  ☑️ channels          [Enable Realtime: ON]
  ☑️ channel_members   [Enable Realtime: ON]
  ☑️ users             [Enable Realtime: ON]
```

---

## בדיקה 3: בדוק לוגים בקונסול 📊

פתח את הקונסול באפליקציה וחפש את הלוגים האלה:

### כשנכנסים לצ'אט:
```
✅ צריך לראות:
🔔 ChatService: Setting up subscription for channel: [channel-id]
🔔 ChatService: Subscription status: SUBSCRIBED
✅ ChatService: Successfully subscribed to channel: [channel-id]

❌ אם אתה רואה:
❌ ChatService: Channel error
⏱️ ChatService: Subscription timed out
🔕 ChatService: Subscription closed
```

### כששולחים הודעה:
```
✅ צריך לראות (בשני המכשירים):
📨 ChatService: Received real-time message payload: ...
📨 ChatService: Payload new: ...
✅ ChatService: Fetched message for realtime: ...
📨 Received real-time message: ...
➕ Adding new real-time message from other user
```

---

## בדיקה 4: בדוק את הגדרות הטבלאות 🗄️

הרץ את `debug_realtime.sql` ב-Supabase SQL Editor:

### תוצאות מצופות:
```sql
-- replica_identity צריך להיות 'FULL' עבור כל הטבלאות:
messages          | FULL
channels          | FULL
channel_members   | FULL
users            | FULL

-- צריכות להיות לפחות 3 policies על messages:
✅ View messages in own channels (SELECT)
✅ Send messages in own channels (INSERT)
✅ Update own messages (UPDATE)
✅ Delete own messages (DELETE)
```

---

## בדיקה 5: בדוק חיבור לאינטרנט 🌐

- ודא שהמכשיר מחובר לאינטרנט
- נסה לרענן את הדף / לסגור ולפתוח את האפליקציה
- בדוק שאין חומת אש שחוסמת WebSocket connections

---

## בדיקה 6: נסה לשלוח הודעה מהקונסול ⌨️

הרץ את זה ב-Supabase SQL Editor (החלף את ה-IDs):

```sql
-- החלף את channel_id ו-sender_id עם IDs אמיתיים
INSERT INTO public.messages (channel_id, sender_id, content, type)
VALUES (
  'YOUR_CHANNEL_ID_HERE',
  'YOUR_USER_ID_HERE',
  'Test message from SQL',
  'text'
);
```

### מה צריך לקרות?
ההודעה צריכה להופיע **מיד** באפליקציה ללא רענון!

---

## בדיקה 7: בדוק שאתה חבר בערוץ 👥

```sql
-- בדוק שהמשתמש שלך הוא חבר בערוץ
SELECT * FROM public.channel_members
WHERE channel_id = 'YOUR_CHANNEL_ID'
AND user_id = 'YOUR_USER_ID';
```

אם אין תוצאות - אתה **לא חבר בערוץ** וזו הבעיה!

---

## מה עושים אם כלום לא עובד? 🆘

1. **אתחל את האפליקציה לגמרי**: סגור ופתח מחדש
2. **נקה cache**: 
   ```bash
   # React Native
   npx expo start --clear
   ```
3. **בדוק גרסת Supabase**:
   ```bash
   npm list @supabase/supabase-js
   ```
   (צריכה להיות 2.x ומעלה)

4. **נסה עם פרופיל Chrome DevTools**: 
   - פתח את DevTools
   - לך ל-Network → WS (WebSockets)
   - בדוק אם יש חיבור פעיל ל-Supabase

---

## 📞 שלח לי את המידע הזה:

אם כלום לא עובד, צלם מסך של:
1. הלוגים בקונסול כששולחים הודעה
2. התוצאות של `debug_realtime.sql`
3. הגדרות Replication בדשבורד של Supabase
4. הגרסה של `@supabase/supabase-js`

ואני אעזור לך לפתור את הבעיה! 🚀

