# מדריך להחלפת Upload Key ב-Play Console

## הבעיה
Play Console דורש keystore עם SHA1:
```
37:BA:6E:E4:5B:3C:54:68:11:FE:D4:3F:6D:37:CD:01:48:46:E4:97
```

אבל EAS משתמש ב-keystore עם SHA1:
```
A1:7F:9C:CC:8F:70:20:52:BB:95:19:D4:1F:46:0B:9B:6B:DC:D5:A3
```

---

## הפתרון: שינוי Upload Key ב-Play Console

### שלב 1: בדוק את App Signing Status

1. עבור ל-**Play Console**
2. **Setup** → **App signing**
3. בדוק את הסטטוס:
   - ✅ אם **Google Play App Signing** מופעל - עבור לשלב 2
   - ❌ אם לא מופעל - עבור לשלב 3

---

### שלב 2: החלפת Upload Key (אם App Signing מופעל)

1. ב-**Play Console** → **Setup** → **App signing**
2. גלול ל-**Upload key certificate**
3. לחץ **"Request upload key reset"**
4. מלא את הטופס:
   - **סיבה**: "Lost original keystore"
   - **הסבר**: "Unable to locate original upload key, requesting reset to continue updates"

**Google ישלח לך אישור תוך 2-3 ימים עבודה.**

לאחר אישור, תוכל להעלות עם ה-EAS keystore החדש.

---

### שלב 3: הפעלת Google Play App Signing (אם לא מופעל)

1. ב-**Play Console** → **Setup** → **App signing**
2. בחר: **"Let Google manage and protect your app signing key"**
3. לחץ **Continue** → **Confirm**

לאחר הפעלה:
- Google ייקח את ה-keystore הקיים כ-"App signing key"
- תוכל להשתמש ב-EAS keystore כ-"Upload key" חדש
- העלה את `app-release-eas.aab` שוב

---

### שלב 4: אם כלום לא עובד - יצור אפליקציה חדשה

אם אי אפשר לשנות את ה-key:
1. צור **אפליקציה חדשה** ב-Play Console
2. שנה את ה-**package name** ב-`app.json`:
   ```json
   "android": {
     "package": "com.darkpool.app.v2"
   }
   ```
3. הרץ:
   ```bash
   npx expo prebuild --clean
   npx eas-cli build --platform android --profile production
   ```

---

## ייצוא Certificate מ-EAS (למקרה שצריך)

אם Play Console מבקש `.pem` file:

```bash
# הוצא certificate מה-AAB
keytool -printcert -jarfile app-release-eas.aab -rfc > eas-upload-cert.pem
```

העלה את `eas-upload-cert.pem` ל-Play Console.

---

## תמיכה

אם יש בעיות, פנה לתמיכת Google Play:
https://support.google.com/googleplay/android-developer/answer/9842756

