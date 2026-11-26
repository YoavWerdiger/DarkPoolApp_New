# 🔧 הוראות תיקון: Device Token לא נכנס למסד הנתונים

## 📊 המצב הנוכחי

**10 משתמשים במערכת, אבל 0 device tokens!**

זה אומר שהאפליקציה **לא מצליחה לרשום device tokens** למסד הנתונים.

---

## ✅ פתרון צעד אחר צעד

### שלב 1: וידוא RLS Policies תקינים

**הרץ את הסקריפט:**
```sql
-- הרץ את: תיקון_RLS_Policies_עכשיו.sql
```

זה יוודא שיש:
- ✅ INSERT policy (הכי חשוב!)
- ✅ SELECT policy
- ✅ UPDATE policy
- ✅ DELETE policy

---

### שלב 2: בדוק את הלוגים באפליקציה

**אחרי שתוודא שה-policies תקינים:**

1. **פתח את האפליקציה**
2. **צא מהחשבון** (Logout)
3. **התחבר מחדש** (Login)
4. **חכה 5-10 שניות** - האפליקציה אמורה לרשום את ה-device token אוטומטית

**בדוק את ה-console logs** - אמור לראות:

```
📱 NotificationService: ==========================================
📱 NotificationService: Starting device token registration...
✅ NotificationService: User found: [user-id]
✅ NotificationService: Permissions granted
✅ NotificationService: Got Expo Push Token: ExponentPushToken[...]
📝 NotificationService: Attempting to insert device token...
✅ NotificationService: Device token registered successfully!
```

---

### שלב 3: בדוק במסד הנתונים

**אחרי התחברות, הרץ:**
```sql
-- בדוק אם נוצר device token
SELECT 
  dt.id,
  dt.user_id,
  LEFT(dt.expo_push_token, 30) || '...' as token_preview,
  dt.platform,
  dt.is_active,
  dt.created_at,
  u.email
FROM device_tokens dt
LEFT JOIN auth.users u ON dt.user_id = u.id
ORDER BY dt.created_at DESC
LIMIT 5;
```

**אמור לראות device token חדש!** ✅

---

## 🔍 סיבות אפשריות לכשל

### 1. אין INSERT policy ❌
**תסמינים:**
- הלוגים יראו: `❌ Error code: 42501` או `RLS Policy error`

**פתרון:**
- הרץ את `תיקון_RLS_Policies_עכשיו.sql`

---

### 2. המשתמש לא נתן הרשאות להתראות ❌
**תסמינים:**
- הלוגים יראו: `⚠️ No permissions, cannot register token`

**פתרון:**
- **iOS:** Settings > DarkPool > Notifications > Allow Notifications
- **Android:** Settings > Apps > DarkPool > Notifications > Allow

---

### 3. רץ על סימולטור/אמולטור ❌
**תסמינים:**
- הלוגים יראו: `⚠️ No token received`
- הלוגים יראו: `Device.isDevice = false`

**פתרון:**
- **חובה:** הרץ על device פיזי (לא סימולטור)
- Expo Push Notifications לא עובד על סימולטור

---

### 4. בעיה ב-Expo Project ID ❌
**תסמינים:**
- הלוגים יראו: `⚠️ Using fallback projectId`
- שגיאה ב-`getExpoPushToken`

**פתרון:**
- בדוק ש-`app.json` מכיל:
  ```json
  "extra": {
    "eas": {
      "projectId": "c6140546-bf96-4ca0-85a5-26807f0742f6"
    }
  }
  ```

---

### 5. בעיה ברשת ❌
**תסמינים:**
- שגיאה ב-`getExpoPushToken`
- timeout או network error

**פתרון:**
- בדוק חיבור לאינטרנט
- נסה שוב

---

## 📝 סיכום

**הצעדים החשובים:**
1. ✅ הרץ `תיקון_RLS_Policies_עכשיו.sql`
2. ✅ התחבר מחדש לאפליקציה
3. ✅ בדוק את הלוגים
4. ✅ בדוק במסד הנתונים אם נוצר device token

**אם עדיין לא עובד:**
- שלח את הלוגים מה-console
- נבדוק מה הבעיה המדויקת


