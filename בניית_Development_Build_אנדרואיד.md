# 🔨 בניית Development Build לאנדרואיד - תתרי שלבים

## 🎯 למה Development Build?

Development Build יאפשר לך לבדוק התראות Push על מכשיר אנדרואיד פיזי (או אמולטור), כי Expo Go לא תומך בהתראות Push כמו שצריך.

---

## 📋 הוראות בנייה מהירות

### שלב 1: וידוא שיש לך EAS CLI

```bash
# בדוק אם מותקן
eas --version

# אם לא, התקן:
npm install -g eas-cli@latest
```

---

### שלב 2: התחברות ל-EAS

```bash
eas login
```

**אם אתה כבר מחובר:**
```bash
eas whoami
```

---

### שלב 3: בניית Development Build לאנדרואיד

```bash
eas build --platform android --profile development
```

**זה יבנה:**
- APK עם development client
- כולל תמיכה מלאה בהתראות Push
- מהיר יותר מ-Production Build

---

## ⏱️ זמן בנייה

**Development Build לוקח כ-10-15 דקות.**

תוכל לעקוב אחרי ההתקדמות:
- בטרמינל
- או ב: https://expo.dev/accounts/darkpoolapp/projects/DarkPool/builds

---

## 📥 הורדה והתקנה

### אחרי שהבנייה מסתיימת:

1. **הורד את ה-APK:**
   - יופיע URL בטרמינל
   - או היכנס ל: https://expo.dev/accounts/darkpoolapp/projects/DarkPool/builds
   - לחץ על ה-build האחרון
   - הורד את ה-APK

2. **התקן על המכשיר:**

   **אופציה א: דרך USB (ADB)**
   ```bash
   adb install path/to/app.apk
   ```

   **אופציה ב: העבר למכשיר ידנית**
   - העבר את ה-APK למכשיר (דרך email, Google Drive, וכו')
   - פתח את הקובץ במכשיר
   - התקן (אולי תצטרך להפעיל "התקן ממקורות לא ידועים")

---

## ✅ בדיקה שהכל עובד

### אחרי התקנה:

1. **פתח את האפליקציה** במכשיר
2. **התחבר** למשתמש
3. **תן הרשאות להתראות** (אם מבקשים)
4. **המתן 10 שניות**

5. **בדוק במסד הנתונים:**
   ```sql
   -- בדוק אם נוצר device token
   SELECT 
     dt.id,
     dt.user_id,
     LEFT(dt.expo_push_token, 30) || '...' as token_preview,
     dt.platform,
     dt.device_id,
     dt.is_active,
     dt.created_at,
     u.email
   FROM device_tokens dt
   LEFT JOIN auth.users u ON dt.user_id = u.id
   WHERE dt.created_at > NOW() - INTERVAL '5 minutes'
   ORDER BY dt.created_at DESC;
   ```

   **אמור לראות device token!** ✅

6. **בדוק התראה:**
   - הוסף חדשה חדשה ל-`app_news`
   - סגור את האפליקציה
   - אמור לקבל התראה push תוך 10-30 שניות! 🎉

---

## 🔧 פתרון בעיות

### Build נכשל:

**בדוק:**
```bash
# וידוא שה-EAS CLI מעודכן
npm install -g eas-cli@latest

# בדיקה שה-eas.json תקין
cat eas.json
```

---

### לא יכול להתקין את ה-APK:

**אנדרואיד:**
1. **הפעל "התקן ממקורות לא ידועים":**
   - הגדרות > אבטחה > התקן ממקורות לא ידועים
   - או: הגדרות > אפליקציות > התקן ממקורות לא ידועים

2. **או התקן דרך ADB:**
   ```bash
   adb install app.apk
   ```

---

### לא מקבל התראות:

**בדוק:**
1. ✅ האם המשתמש נתן הרשאות להתראות?
2. ✅ האם נוצר device token במסד הנתונים?
3. ✅ האם ההתראות מופעלות במסך ההגדרות?
4. ✅ האם יש שגיאות ב-Logs של Edge Functions?

---

## 💡 טיפים

### אפשרות 1: Preview Build (אופציה נוספת)

אם Development Build לא עובד, נסה Preview Build:

```bash
eas build --platform android --profile preview
```

זה יוצר build בינוני - יותר קל מ-Production אבל פחות מ-Development.

---

### אפשרות 2: Production Build (לבדיקה אמיתית)

אם אתה רוצה לבדוק כמו שזה יהיה ב-Production:

```bash
eas build --platform android --profile production
```

**⚠️ זה לוקח יותר זמן (15-20 דקות) ויוצר AAB (לא APK)**

---

## 📝 הערות חשובות

- **Development Build** יוצר APK - קל להתקין
- **Production Build** יוצר AAB - צריך להעלות ל-Google Play Console
- **Development Build** עדיין כולל את כל הפיצ'רים, כולל Push Notifications ✅
- **זמן בנייה:** 10-15 דקות (Development) vs 15-20 דקות (Production)

---

## 🚀 מה הלאה?

אחרי שיש לך Development Build מותקן:

1. **בדוק שה-device token נרשם** ✅
2. **בדוק שההתראות עובדות** ✅
3. **אם הכל עובד - המערכת מוכנה!** 🎉

---

**בהצלחה!** 🔨



