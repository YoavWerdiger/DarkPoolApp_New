# בקשה להחלפת Upload Key ב-Play Console

## הוראות

1. **עבור ל-Play Console**: https://play.google.com/console
2. בחר את האפליקציה: **DarkPool** (`com.darkpool.app`)
3. **Setup** → **App signing**
4. גלול למטה ל-**"Upload key certificate"**
5. לחץ על **"Request upload key reset"** או **"Use a different key"**

---

## פרטים למילוי בטופס

### **Reason for reset:**
```
Lost access to original upload keystore
```

### **Detailed explanation:** (העתק את הטקסט הזה)
```
The original upload keystore with SHA-1 fingerprint 37:BA:6E:E4:5B:3C:54:68:11:FE:D4:3F:6D:37:CD:01:48:46:E4:97 was lost during our development environment migration and is no longer accessible in our build system.

We have generated a new upload keystore through Expo Application Services (EAS) with the following fingerprints:

SHA-1:   A1:7F:9C:CC:8F:70:20:52:BB:95:19:D4:1F:46:0B:9B:6B:DC:D5:A3
SHA-256: 2E:9C:20:08:32:B8:D1:B1:6E:AF:FB:05:39:6D:25:25:8E:F2:A9:E6:EA:BA:35:E8:27:DC:CF:80:E6:B3:68:18
MD5:     7A:21:94:F3:19:E3:5E:7B:B3:C9:75:C2:4E:A7:58:B3

The upload certificate (.pem) is attached to this request.

We kindly request approval to use this new keystore for future app updates.

Package name: com.darkpool.app
App name: DarkPool
```

---

## קובץ Certificate להעלאה

**צרף את הקובץ הזה לטופס:**
```
/Users/yoavwerdiger/DarkPoolApp_New-1/upload-cert-new.pem
```

אם הקובץ לא נמצא, צור אותו מחדש:
```bash
cd /Users/yoavwerdiger/DarkPoolApp_New-1
keytool -printcert -jarfile app-release-v96.aab -rfc > upload-cert-new.pem
```

---

## אחרי שליחת הבקשה

1. **Google ישלח אישור אוטומטי** למייל שרשום בחשבון המפתח
2. **תהליך האישור לוקח 2-3 ימי עבודה**
3. **תקבל מייל** כשהבקשה אושרה
4. **אז תוכל להעלות** את `app-release-v96.aab` ללא בעיות

---

## AAB מוכן להעלאה (לאחר אישור)

```
קובץ:     /Users/yoavwerdiger/DarkPoolApp_New-1/app-release-v96.aab
Package:  com.darkpool.app ✅
Version:  96
SHA1:     A1:7F:9C:CC:8F:70:20:52:BB:95:19:D4:1F:46:0B:9B:6B:DC:D5:A3 ✅
גודל:     59MB
```

---

## טיפים

- **אם הטופס מבקש "Public key certificate"**: צרף את `upload-cert-new.pem`
- **אם הטופס מבקש SHA-1/SHA-256**: העתק מהטבלה למעלה
- **אם אין אפשרות "Request upload key reset"**: 
  - חפש "App signing" → "Upload key" → "Request new key"
  - או פנה לתמיכה: https://support.google.com/googleplay/android-developer/

---

## קישורים מועילים

- Google Play App Signing: https://support.google.com/googleplay/android-developer/answer/9842756
- Upload Key Reset: https://support.google.com/googleplay/android-developer/answer/7384423
- תמיכה: https://support.google.com/googleplay/android-developer/

