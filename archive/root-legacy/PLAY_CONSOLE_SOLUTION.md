# פתרון בעיית Keystore ב-Play Console

## הבעיה
Play Console מצפה ל-AAB עם:
- ✅ Package: `com.darkpool.app`
- ✅ Keystore SHA1: `37:BA:6E:E4:5B:3C:54:68:11:FE:D4:3F:6D:37:CD:01:48:46:E4:97`

אבל:
- ❌ ה-keystore הזה (SHA1: `37:BA...`) נוצר כש-package היה `com.darkpoolapp.DarkPool`
- ❌ כש-package שונה ל-`com.darkpool.app`, EAS יצר keystore חדש (SHA1: `A1:7F...`)

**אין AAB עם שני התנאים יחד!**

---

## הפתרון - 3 אופציות

### אופציה 1: Request Upload Key Reset (מומלץ) ⭐

1. **Play Console** → **Setup** → **App signing**
2. גלול ל-**"Upload key certificate"**
3. לחץ **"Request upload key reset"**
4. מלא את הטופס:
   ```
   Reason: Lost original keystore
   Explanation: The original upload keystore was created with an incorrect 
   package name (com.darkpoolapp.DarkPool instead of com.darkpool.app). 
   After fixing the package name, a new keystore was generated. 
   We need to update the upload key to match the correct package name.
   ```
5. **Submit request**

**Google ישלח אישור תוך 2-3 ימים עבודה.**

לאחר אישור:
- העלה את: `/Users/yoavwerdiger/DarkPoolApp_New-1/app-release-eas.aab`
- Package: `com.darkpool.app` ✅
- SHA1: `A1:7F:9C:CC:8F:70:20:52:BB:95:19:D4:1F:46:0B:9B:6B:DC:D5:A3` ✅

---

### אופציה 2: הפעל Google Play App Signing (מיידי אם זמין)

אם **Google Play App Signing** לא מופעל:

1. **Play Console** → **Setup** → **App signing**
2. בחר: **"Let Google manage and protect your app signing key"**
3. לחץ **Continue** → **Confirm**

לאחר הפעלה:
- Google ייקח את ה-keystore הקיים כ-"App signing key"
- תוכל להעלות AAB עם keystore חדש כ-"Upload key"
- העלה את: `app-release-eas.aab`

---

### אופציה 3: מצא את ה-keystore המקורי

אם יש לך גישה ל-keystore המקורי (`.jks` או `.keystore` file):

1. העלה את ה-keystore ל-EAS
2. בנה AAB חדש עם:
   - Package: `com.darkpool.app`
   - Keystore הישן (SHA1: `37:BA...`)

**בעיה**: הקובץ כנראה לא נמצא במחשב.

---

## הקובץ המוכן להעלאה

```
/Users/yoavwerdiger/DarkPoolApp_New-1/app-release-eas.aab
```

**פרטים:**
- Package: `com.darkpool.app` ✅
- SHA1: `A1:7F:9C:CC:8F:70:20:52:BB:95:19:D4:1F:46:0B:9B:6B:DC:D5:A3`
- Version code: 95
- גודל: 59MB

---

## המלצה

1. **נסה אופציה 2** (Google Play App Signing) - אם זמין, זה מיידי
2. **אם לא**, שלח **Request Upload Key Reset** (אופציה 1)
3. **תוך 2-3 ימים** תוכל להעלות את `app-release-eas.aab`

---

## קישורים מועילים

- Play Console App Signing: https://play.google.com/console/u/0/developers/YOUR_DEVELOPER_ID/app/YOUR_APP_ID/keymanagement
- תמיכה: https://support.google.com/googleplay/android-developer/answer/9842756

