# בניית Production Build לבדיקת התראות

## 🎯 למה צריך Production Build?

התראות Push עובדות רק ב-**Production Build** או ב-**Development Build** עם development client. לא עובדות ב-Expo Go!

---

## 📋 שלבים לבניית Production Build:

### שלב 1: התקנת EAS CLI (אם עדיין לא מותקן)

```bash
npm install -g eas-cli
```

### שלב 2: התחברות ל-EAS

```bash
eas login
```

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

1. **הורד את ה-AAB/APK** מה-URL שמופיע בטרמינל
2. **או היכנס ל-EAS Dashboard**:
   - https://expo.dev/accounts/darkpoolapp/projects/DarkPool/builds
   - לחץ על ה-build האחרון
   - הורד את ה-AAB/APK

---

## 📱 התקנה על מכשיר:

### אנדרואיד:

1. **העבר את ה-AAB/APK למכשיר** (דרך USB, email, וכו')
2. **התקן**:
   - אם זה APK: פתח את הקובץ והתקן ישירות
   - אם זה AAB: צריך להמיר ל-APK או להתקין דרך Google Play Console (Internal Testing)

**או דרך ADB:**
```bash
adb install path/to/app.apk
```

### אייפון:

1. **הורד את ה-IPA**
2. **התקן דרך Xcode** או דרך TestFlight

---

## ✅ בדיקת התראות ב-Production Build:

לאחר התקנת ה-build:

1. **פתח את האפליקציה** במכשיר
2. **התחבר** (אם צריך)
3. **ודא שהמשתמש נתן הרשאות להתראות** (אם זה בפעם הראשונה)
4. **בדוק שה-device token נרשם**:
   - Supabase Dashboard > Table Editor > `device_tokens`
   - אמור לראות רשומה עם ה-token שלך

5. **הוסף חדשה חדשה** ל-`app_news`
6. **אמור לקבל התראה push תוך כמה שניות!** 🎉

---

## 🔧 פתרון בעיות:

### Build נכשל:
- בדוק שה-EAS CLI מעודכן: `npm install -g eas-cli@latest`
- בדוק שה-`eas.json` תקין
- בדוק שה-`app.json` תקין

### לא מקבל התראות:
- ✅ ודא שהמשתמש נתן הרשאות להתראות
- ✅ בדוק שה-device token נרשם ב-`device_tokens`
- ✅ בדוק ב-Logs של Edge Functions אם יש שגיאות
- ✅ ודא שהמכשיר מחובר לאינטרנט

### Build לוקח יותר מדי זמן:
- זה נורמלי - Production builds לוקחים 10-20 דקות
- אפשר לעקוב אחרי ההתקדמות ב-EAS Dashboard

---

## 💡 טיפים:

1. **Development Build** (מהיר יותר לבדיקות):
   ```bash
   eas build --platform android --profile development
   ```
   זה יוצר build עם development client - מהיר יותר אבל עדיין צריך production build לבדיקת התראות אמיתיות.

2. **Preview Build** (בינוני):
   ```bash
   eas build --platform android --profile preview
   ```
   זה יוצר build לבדיקות פנימיות.

3. **Local Build** (אם יש לך Android Studio):
   - ראה `BUILD_WITH_ANDROID_STUDIO.md`

---

## 📝 הערות חשובות:

- **Expo Go לא תומך בהתראות Push** - חייב Production/Development Build
- **Production Build** הוא היחיד שיכול להיכנס ל-Google Play Store
- **Development Build** מהיר יותר לבדיקות אבל עדיין צריך production לבדיקת התראות אמיתיות

---

## 🎉 אחרי שהכל עובד:

אם ההתראות עובדות ב-Production Build, המערכת מוכנה! 🚀

אפשר להעלות ל-Google Play Store:
```bash
eas submit --platform android --profile production
```

או להעלות ידנית דרך Google Play Console.







