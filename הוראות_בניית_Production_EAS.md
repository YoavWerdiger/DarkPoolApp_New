# 🚀 הוראות בניית Production Build עם EAS

## ✅ מה כבר מוכן:
- ✅ `eas.json` מוגדר עם profile `production`
- ✅ Expo Project ID מוגדר: `c6140546-bf96-4ca0-85a5-26807f0742f6`
- ✅ כל הקוד מוכן

---

## 📋 שלבים לבנייה:

### שלב 1: התקנת EAS CLI (אם צריך)

```bash
npm install -g eas-cli
```

---

### שלב 2: התחברות ל-EAS

```bash
eas login
```

---

### שלב 3: בניית Production Build

**לאנדרואיד:**
```bash
eas build --platform android --profile production
```

**לאייפון (אם צריך):**
```bash
eas build --platform ios --profile production
```

**לשניהם:**
```bash
eas build --platform all --profile production
```

---

## ⏱️ זמן בנייה:

הבנייה לוקחת כ-**10-20 דקות**. תוכל לעקוב אחרי ההתקדמות ב:
- הטרמינל
- https://expo.dev/accounts/darkpoolapp/projects/DarkPool/builds

---

## 📥 הורדת ה-Build:

לאחר שהבנייה מסתיימת:

1. **הורד את ה-AAB** מה-URL שמופיע בטרמינל
2. **או היכנס ל-EAS Dashboard**:
   - https://expo.dev/accounts/darkpoolapp/projects/DarkPool/builds
   - לחץ על ה-build האחרון
   - הורד את ה-AAB

---

## 📱 התקנה על מכשיר:

### אנדרואיד:

**אופציה 1: דרך ADB (הכי פשוט)**
```bash
# המר AAB ל-APK (אם צריך)
# או השתמש ב-bundletool
# או התקן דרך Google Play Console (Internal Testing)
```

**אופציה 2: דרך Google Play Console**
1. העלה את ה-AAB ל-Google Play Console
2. שחרר ל-Internal Testing
3. התקן דרך Play Store

**אופציה 3: APK ישיר**
אם יש לך APK, פשוט העבר למכשיר והתקן.

---

## ✅ אחרי התקנה - בדיקת התראות:

1. **פתח את האפליקציה** במכשיר
2. **התחבר** למשתמש
3. **חכה 5-10 שניות** - device token יירשם אוטומטית
4. **ודא שהמשתמש נתן הרשאות להתראות** (אם זה בפעם הראשונה)
5. **סגור את האפליקציה** (או תן לה להיות ברקע)
6. **הוסף חדשה חדשה** (או חכה לחדשה אמיתית)
7. **תקבל התראה Push!** 📱

---

## 🔍 בדיקות:

### בדיקה 1: Device Token נרשם?
```sql
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
WHERE dt.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY dt.created_at DESC;
```

### בדיקה 2: התראות נשלחו?
- בדוק את הלוגים של Edge Function
- לך ל: Supabase Dashboard > Edge Functions > `send-push-notification` > Logs

---

## 🎯 סיכום:

1. **בנה:** `eas build --platform android --profile production`
2. **התקן** על מכשיר פיזי
3. **התחבר** → device token יירשם אוטומטית
4. **סגור את האפליקציה**
5. **הוסף חדשה חדשה** → תקבל התראה Push! 📱

**הכל מוכן! בואו נבנה! 🚀**


