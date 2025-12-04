# 📱 דוח בדיקה מקיפה - מערכת התראות Push

## 📊 סיכום מצב נוכחי

### ✅ מה שכבר קיים ועובד:

#### 1. תשתית בסיסית
- ✅ **שירות התראות** (`services/notificationService.ts`)
  - רישום device tokens
  - בקשות הרשאות מהמשתמש
  - שליחת התראות מקומיות לבדיקה
  - תמיכה בהאזנה להתראות
  
- ✅ **Edge Functions**
  - `send-push-notification` - שליחת התראות למשתמשים ספציפיים
  - `process-pending-notifications` - עיבוד התראות ממתינות מטבלה
  
- ✅ **טבלאות במסד הנתונים**
  - `device_tokens` - רישום מכשירים של משתמשים
  - `pending_notifications` - טבלת התראות ממתינות
  
- ✅ **מסך הגדרות** (`screens/Profile/NotificationsScreen.tsx`)
  - הגדרות לכל סוג התראה
  - שמירה ב-AsyncStorage
  - ממשק משתמש מלא

- ✅ **אתחול אוטומטי**
  - רישום device token אוטומטי כשהמשתמש נכנס
  - טיפול בהתראות ב-`App.tsx`
  - ניווט אוטומטי כשלוחצים על התראה

---

## ❌ מה שחסר או לא עובד:

### 1. התראות חדשות - חלקי ⚠️

**מה יש:**
- ✅ Trigger `on_new_news_article` על טבלת `app_news`
- ✅ פונקציה `send_news_notification_immediately()` שיוצרת התראות ב-`pending_notifications`
- ✅ קריאה ל-Edge Function דרך pg_net

**מה חסר:**
- ❌ **אין בדיקה של הגדרות המשתמש** - ההתראות נשלחות לכל המשתמשים גם אם כיבו התראות חדשות
- ❌ **אין סינון לפי העדפות** - לא בודק אם המשתמש רוצה התראות חדשות (`newsNotifications`)

**בעיות:**
```sql
-- הטריגר הנוכחי שולח לכל המשתמשים עם device tokens
-- אבל לא בודק את ההגדרות שלהם!
INSERT INTO public.pending_notifications (user_id, title, body, ...)
SELECT DISTINCT dt.user_id, ...
FROM public.device_tokens dt
WHERE dt.is_active = true
  AND dt.user_id IS NOT NULL;
-- ❌ חסר: AND user.wants_news_notifications = true
```

---

### 2. התראות דיווחי רווחים - לא קיים ❌

**מה יש:**
- ✅ Edge Functions לעדכון דיווחי רווחים
- ✅ טבלת `earnings_calendar` עם דיווחים
- ✅ הגדרה במסך התראות (`earningsNotifications`)

**מה חסר:**
- ❌ **אין trigger** על טבלת `earnings_calendar`
- ❌ **אין לוגיקה** ליצירת התראות כשמופיע דיווח חדש
- ❌ **אין אינטגרציה** עם מערכת ההתראות

**מה צריך:**
- טריגר על INSERT/UPDATE בטבלת `earnings_calendar`
- יצירת התראות רק למשתמשים עם `earningsNotifications = true`
- התראות לפני דיווח (למשל שעה לפני)

---

### 3. התראות יומן כלכלי - לא קיים ❌

**מה יש:**
- ✅ Edge Functions לעדכון אירועים כלכליים
- ✅ טבלת `economic_events` עם אירועים
- ✅ הגדרה במסך התראות (`economicCalendarNotifications`)

**מה חסר:**
- ❌ **אין trigger** על טבלת `economic_events`
- ❌ **אין לוגיקה** ליצירת התראות על אירועים חשובים
- ❌ **אין סינון** לפי רמת חשיבות (high importance)

**מה צריך:**
- טריגר על INSERT/UPDATE בטבלת `economic_events`
- יצירת התראות רק למשתמשים עם `economicCalendarNotifications = true`
- התראות רק על אירועים עם `importance = 'high'`
- התראות לפני האירוע (למשל שעה/יום לפני)

---

### 4. התראות הודעות צ'אט - לא קיים ❌

**מה יש:**
- ✅ מערכת צ'אט מלאה עם realtime
- ✅ טבלת `messages` עם הודעות
- ✅ הגדרה במסך התראות (`messageNotifications`)
- ✅ הגדרות לקבוצות ספציפיות (`groupNotifications`)

**מה חסר:**
- ❌ **אין trigger** על טבלת `messages`
- ❌ **אין לוגיקה** ליצירת התראות כשמתקבלת הודעה
- ❌ **אין סינון** - האם המשתמש בקובצה? האם הוא משתיק אותה?
- ❌ **אין בדיקה** אם המשתמש עם האפליקציה פתוחה

**מה צריך:**
- טריגר על INSERT בטבלת `messages`
- בדיקה אם המשתמש מעוניין בהתראות הודעות
- בדיקה אם הקבוצה ספציפית לא מושתקת
- בדיקה אם המשתמש עם האפליקציה פתוחה (לא לשלוח אם הוא רואה את הצ'אט)
- התראה רק אם המשתמש לא קרא את ההודעה

---

### 5. בדיקת הגדרות משתמש - חסר לחלוטין ❌

**הבעיה הגדולה ביותר:**
- כל ההתראות נשלחות **בלי לבדוק את ההגדרות** של המשתמש
- ההגדרות נשמרות ב-`AsyncStorage` (במכשיר) אבל השרת לא יודע עליהן!

**פתרונות אפשריים:**

**אופציה 1: שמירת הגדרות בטבלה (מומלץ)**
```sql
CREATE TABLE user_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  news_notifications BOOLEAN DEFAULT true,
  earnings_notifications BOOLEAN DEFAULT true,
  economic_calendar_notifications BOOLEAN DEFAULT true,
  message_notifications BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**אופציה 2: שדה JSONB בטבלת users**
```sql
ALTER TABLE public.users ADD COLUMN notification_settings JSONB DEFAULT '{
  "news": true,
  "earnings": true,
  "economic": true,
  "messages": true
}'::jsonb;
```

**אופציה 3: שמירה ב-`pending_notifications` עם סינון מאוחר**
- לא מומלץ - יוצר התראות מיותרות

---

## 🎯 תוכנית פעולה - סדרי עדיפויות

### שלב 1: תשתית בדיקת הגדרות (חובה!) 🔴

1. **יצירת טבלת הגדרות במסד הנתונים**
   - טבלה `user_notification_settings`
   - RLS policies מתאימות
   - עדכון ממסך ההגדרות

2. **עדכון מסך ההגדרות**
   - שמירה גם במסד הנתונים (לא רק AsyncStorage)
   - סנכרון אוטומטי

3. **עדכון Edge Functions**
   - בדיקת הגדרות לפני שליחת התראות
   - סינון משתמשים לפי העדפות

---

### שלב 2: תיקון התראות חדשות (חשוב!) 🟠

1. **עדכון הטריגר**
   - הוספת JOIN לטבלת הגדרות
   - סינון רק משתמשים עם `news_notifications = true`

2. **בדיקה וניקוי**
   - וידוא שהטריגר עובד
   - בדיקת ביצועים

---

### שלב 3: הוספת התראות דיווחי רווחים 🟡

1. **יצירת טריגר**
   - על טבלת `earnings_calendar`
   - יצירת התראות רק למשתמשים עם `earnings_notifications = true`
   - התראות לפני הדיווח (שעה לפני)

2. **Edge Function**
   - עדכון קיים או יצירת חדש
   - אינטגרציה עם מערכת ההתראות

---

### שלב 4: הוספת התראות יומן כלכלי 🟡

1. **יצירת טריגר**
   - על טבלת `economic_events`
   - סינון רק אירועים עם `importance = 'high'`
   - התראות רק למשתמשים עם `economic_calendar_notifications = true`
   - התראות לפני האירוע

2. **Edge Function**
   - אינטגרציה עם מערכת ההתראות
   - טיפול באירועים חוזרים

---

### שלב 5: הוספת התראות הודעות (מורכב יותר) 🔵

1. **יצירת טריגר**
   - על טבלת `messages`
   - בדיקה מורכבת: קבוצה, משתמש, השתקה

2. **לוגיקה מורכבת**
   - בדיקה אם המשתמש עם האפליקציה פתוחה (לפי presence)
   - בדיקת השתקת קבוצות ספציפיות
   - בדיקה אם המשתמש כבר קרא את ההודעה

3. **Edge Function מותאם**
   - טיפול בהתראות הודעות
   - ניהול rate limiting

---

## 🔍 בדיקות שצריך לבצע עכשיו

### 1. בדיקת טבלת device_tokens
```sql
SELECT COUNT(*) as total_tokens, 
       COUNT(DISTINCT user_id) as unique_users,
       COUNT(*) FILTER (WHERE is_active = true) as active_tokens
FROM device_tokens;
```

### 2. בדיקת טבלת pending_notifications
```sql
SELECT notification_type,
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE is_sent = false) as pending,
       COUNT(*) FILTER (WHERE is_sent = true) as sent
FROM pending_notifications
GROUP BY notification_type;
```

### 3. בדיקת טריגרים פעילים
```sql
SELECT tgname as trigger_name,
       tgrelid::regclass as table_name,
       tgenabled as enabled
FROM pg_trigger
WHERE tgname LIKE '%notification%' OR tgname LIKE '%news%';
```

### 4. בדיקת Edge Functions
- האם `send-push-notification` פעיל?
- האם `process-pending-notifications` פעיל?
- מה ב-Logs שלהם?

---

## 📝 המלצות טכניות

### 1. שימוש ב-AsyncStorage VS Database

**AsyncStorage (נוכחי):**
- ✅ מהיר במכשיר
- ✅ עובד offline
- ❌ השרת לא יודע על ההגדרות
- ❌ לא עובד להתראות server-side

**Database (מומלץ):**
- ✅ נגיש מהשרת
- ✅ סינכרון בין מכשירים
- ✅ עובד עם triggers ו-Edge Functions
- ⚠️ צריך אינטרנט לעדכון

**פתרון היברידי (מומלץ ביותר):**
- שמירה גם ב-Database (להתראות server-side)
- שמירה גם ב-AsyncStorage (לשימוש במכשיר)
- סנכרון אוטומטי

---

### 2. מבנה טבלת הגדרות

```sql
CREATE TABLE user_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- הגדרות כלליות
  notifications_enabled BOOLEAN DEFAULT true,
  sound_enabled BOOLEAN DEFAULT true,
  vibration_enabled BOOLEAN DEFAULT true,
  
  -- התראות לפי סוג
  news_notifications BOOLEAN DEFAULT true,
  earnings_notifications BOOLEAN DEFAULT true,
  economic_calendar_notifications BOOLEAN DEFAULT true,
  message_notifications BOOLEAN DEFAULT true,
  
  -- צלילים
  news_sound BOOLEAN DEFAULT true,
  community_sound BOOLEAN DEFAULT true,
  
  -- עדכונים
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- RLS
  CONSTRAINT user_notification_settings_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE
);

-- אינדקסים
CREATE INDEX idx_user_notification_settings_user_id 
  ON user_notification_settings(user_id);

-- RLS Policies
ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
  ON user_notification_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON user_notification_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON user_notification_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- טריגר לעדכון updated_at
CREATE OR REPLACE FUNCTION update_user_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_notification_settings_updated_at
  BEFORE UPDATE ON user_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_notification_settings_updated_at();
```

---

### 3. עדכון process-pending-notifications

```typescript
// לפני שליחה, בדוק את ההגדרות של המשתמש
const { data: userSettings } = await supabase
  .from('user_notification_settings')
  .select('*')
  .eq('user_id', userId)
  .single();

// אם אין הגדרות, צור ברירת מחדל
if (!userSettings) {
  await supabase
    .from('user_notification_settings')
    .insert({
      user_id: userId,
      // ברירת מחדל - הכל פעיל
    });
  // המשך עם ברירת מחדל
}

// בדוק אם המשתמש רוצה התראות מסוג זה
if (notification.notification_type === 'news' && !userSettings.news_notifications) {
  // דלג על המשתמש הזה
  continue;
}

if (notification.notification_type === 'earnings' && !userSettings.earnings_notifications) {
  continue;
}

// ... וכו'
```

---

## ✅ סיכום נקודות פעולה

### דחוף (לעשות עכשיו):
1. ✅ יצירת טבלת `user_notification_settings`
2. ✅ עדכון מסך ההגדרות לשמירה גם במסד הנתונים
3. ✅ עדכון `process-pending-notifications` לבדיקת הגדרות

### חשוב (להשלים השבוע):
4. ✅ תיקון טריגר התראות חדשות לבדיקת הגדרות
5. ✅ הוספת טריגר להתראות דיווחי רווחים
6. ✅ הוספת טריגר להתראות יומן כלכלי

### נחמד (בעתיד):
7. ⏳ הוספת התראות הודעות צ'אט
8. ⏳ שיפור ביצועים וניקוי
9. ⏳ סטטיסטיקות ומעקב

---

## 📞 שאלות לבדיקה

1. **כמה משתמשים יש עם device tokens פעילים?**
2. **כמה התראות נשלחו בשבוע האחרון?**
3. **מה שיעור ההצלחה של שליחת התראות?**
4. **אילו שגיאות יש ב-Logs של Edge Functions?**
5. **האם המשתמשים מקבלים התראות גם כשהם לא רוצים?**

---

**תאריך יצירת הדוח:** {{ היום }}
**נכתב על ידי:** AI Assistant
**סטטוס:** בדיקה ראשונית הושלמה



