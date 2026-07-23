# 🔧 תיקון רישום Device Token

## ❌ הבעיה: אין device token למשתמש

**סיבות אפשריות:**
1. המשתמש לא התחבר לאפליקציה
2. האפליקציה לא רשמה את ה-device token
3. המשתמש לא נתן הרשאות להתראות
4. יש בעיה ב-NotificationService

---

## 🔍 אבחון - בדיקות

### בדיקה 1: האם יש device tokens בכלל במערכת?

```sql
-- בדוק כמה device tokens יש במערכת
SELECT 
  COUNT(*) as total_tokens,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) FILTER (WHERE is_active = true) as active_tokens
FROM device_tokens;
```

**אם יש תוצאה:**
- ✅ יש device tokens במערכת
- ✅ המערכת עובדת - רק המשתמש שלך לא נרשם

**אם אין תוצאה:**
- ❌ אין device tokens בכלל
- ❌ בעיה כללית במערכת

---

### בדיקה 2: בדוק אם המשתמש קיים

```sql
-- בדוק אם המשתמש קיים
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE id = 'af781bb1-0529-4d80-9424-6564ec29457e';
```

---

### בדיקה 3: בדוק כל ה-device tokens

```sql
-- בדוק את כל ה-device tokens במערכת
SELECT 
  dt.id,
  dt.user_id,
  dt.expo_push_token,
  dt.device_id,
  dt.platform,
  dt.is_active,
  dt.created_at,
  u.email
FROM device_tokens dt
LEFT JOIN auth.users u ON dt.user_id = u.id
ORDER BY dt.created_at DESC
LIMIT 20;
```

---

## 🔧 פתרון - איך לרשום device token

### פתרון 1: התחברות לאפליקציה מחדש

**באפליקציה:**

1. **פתח את האפליקציה**
2. **צא מהחשבון** (Logout)
3. **התחבר שוב** (Login)
4. **חכה 5-10 שניות** - האפליקציה אמורה לרשום את ה-device token אוטומטית

**במסד הנתונים - בדוק שוב:**
```sql
-- בדוק שוב אחרי התחברות
SELECT 
  dt.id,
  dt.user_id,
  dt.expo_push_token,
  dt.device_id,
  dt.platform,
  dt.is_active,
  dt.created_at
FROM device_tokens dt
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND dt.is_active = true;
```

---

### פתרון 2: בדוק הרשאות התראות

**במכשיר:**

1. **iOS:**
   - הגדרות > DarkPool > התראות
   - ודא שההתראות מופעלות

2. **Android:**
   - הגדרות > אפליקציות > DarkPool > התראות
   - ודא שההתראות מופעלות

**באפליקציה:**
- כשהאפליקציה מבקשת הרשאות להתראות - לחץ "אשר"

---

### פתרון 3: בדיקה ידנית - רישום device token

**אם עדיין לא עובד, אפשר לבדוק בלוגים:**

1. **פתח את האפליקציה**
2. **פתח את ה-Developer Tools** (אם יש)
3. **חפש לוגים:**
   - `📱 NotificationService: Starting device token registration...`
   - `✅ NotificationService: Device token registered successfully`
   - `❌ NotificationService: Error...`

---

### פתרון 4: בדיקת הקוד

**בודק אם NotificationService נקרא:**

**קובץ:** `context/AuthContext.tsx`

```typescript
// אחרי התחברות, צריך להיות:
if (user) {
  setTimeout(async () => {
    const result = await NotificationService.registerDeviceToken();
    console.log('📱 AuthContext: registerDeviceToken result:', result);
  }, 2000);
}
```

**בודק אם יש שגיאות:**
- אם יש שגיאת RLS → בעיה ב-RLS Policies
- אם יש שגיאת network → בעיית אינטרנט
- אם אין הרשאות → המשתמש צריך לאשר

---

## 🔍 בדיקות נוספות

### בדיקה: האם יש בעיה ב-RLS?

```sql
-- בדוק את ה-RLS Policies על device_tokens
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'device_tokens';
```

**אמור להיות:**
- `Users can view their own device tokens` (SELECT)
- `Users can insert their own device tokens` (INSERT)
- `Users can update their own device tokens` (UPDATE)

---

### בדיקה: האם הטבלה קיימת?

```sql
-- בדוק אם הטבלה קיימת
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'device_tokens';
```

---

### בדיקה: האם יש device token לא פעיל?

```sql
-- בדוק אם יש device token לא פעיל למשתמש
SELECT 
  id,
  user_id,
  expo_push_token,
  is_active,
  created_at,
  updated_at
FROM device_tokens
WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e';
```

**אם יש תוצאה עם `is_active = false`:**
- יש device token אבל הוא לא פעיל
- צריך להפעיל אותו

```sql
-- הפעל device token לא פעיל
UPDATE device_tokens
SET is_active = true,
    updated_at = NOW()
WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e';
```

---

## ✅ פעולות מומלצות

1. **צא והתחבר שוב** לאפליקציה
2. **ודא שההתראות מופעלות** במכשיר ובאפליקציה
3. **חכה 10 שניות** אחרי ההתחברות
4. **בדוק שוב** ב-SQL
5. **אם עדיין לא עובד** - בדוק את ה-Logs

---

## 📝 שאלות לבדיקה

1. האם אתה רואה את האפליקציה נפתחת?
2. האם אתה רואה בקשה להרשאות התראות?
3. האם יש לוגים בקונסול (אם יש)?
4. האם יש שגיאות ב-Supabase Dashboard > Logs?

---

**בוא נבדוק יחד מה הבעיה!**



