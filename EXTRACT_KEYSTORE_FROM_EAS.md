# חילוץ Keystore מ-EAS

## המצב
Play Console דורש keystore עם SHA1:
```
37:BA:6E:E4:5B:3C:54:68:11:FE:D4:3F:6D:37:CD:01:48:46:E4:97
```

ה-keystore הזה נמצא ב-EAS (שימש ב-builds 317a7206 ו-40956f0a).

---

## שלב 1: גלה אילו keystores יש ב-EAS

עבור ל-EAS Web Console:
https://expo.dev/accounts/darkpoolapp/projects/DarkPool/credentials

או הרץ:
```bash
npx eas-cli credentials
```

בחר:
1. Android
2. Production profile
3. **View credentials**

---

## שלב 2: בדוק אם יש 2 keystores

אם יש **2 keystores שונים**:
- **Keystore 1** (ישן): SHA1 `37:BA:6E:E4...` - זה מה שצריך!
- **Keystore 2** (חדש): SHA1 `A1:7F:9C:CC...` - זה מה שEAS משתמש בו כרגע

---

## שלב 3: החלף ל-keystore הישן

ב-EAS credentials:
1. **Remove** את ה-keystore החדש (SHA1: `A1:7F...`)
2. **Set as default** את ה-keystore הישן (SHA1: `37:BA...`)
3. **הרץ build חדש**:
   ```bash
   npx eas-cli build --platform android --profile production
   ```

---

## אם יש רק keystore אחד

אם EAS מציג **רק keystore אחד** (SHA1: `A1:7F...`):

### אופציה A: ייבוא ה-keystore הישן
אם יש לך את הקובץ המקורי:
```bash
npx eas-cli credentials
# בחר Android → Production → Keystore → Upload new keystore
```

### אופציה B: חילוץ מ-AAB ישן
לא ניתן לחלץ private key מ-AAB, אבל **אולי ה-keystore שמור במקום אחר**:

חפש בכל המחשב:
```bash
find ~ -name "*.keystore" -o -name "*.jks" 2>/dev/null | grep -v ".gradle"
```

חפש ב-iCloud/Google Drive/Dropbox:
```
darkpool.keystore
release.keystore
upload-key.keystore
```

---

## אם לא מצאת את ה-keystore

**אין ברירה - צריך לבקש מ-Play Console להחליף upload key:**

1. **Play Console** → **Setup** → **App signing**
2. **"Request upload key reset"**
3. סיבה: "Lost access to original keystore"
4. הסבר מפורט:
   ```
   The original upload keystore (SHA1: 37:BA:6E:E4:5B:3C:54:68:11:FE:D4:3F:6D:37:CD:01:48:46:E4:97) 
   was lost during development environment migration. 
   
   EAS Build has generated a new keystore (SHA1: A1:7F:9C:CC:8F:70:20:52:BB:95:19:D4:1F:46:0B:9B:6B:DC:D5:A3).
   
   We need to update the upload key certificate to continue releasing updates.
   
   New certificate (.pem) is attached.
   ```

5. **צרף certificate** מה-AAB החדש:
   ```bash
   keytool -printcert -jarfile app-release-v96.aab -rfc > upload-cert.pem
   ```

6. **Upload** את `upload-cert.pem` לטופס

7. **חכה 2-3 ימים עבודה** לאישור

---

## סיכום צעדים

1. ✅ נסה למצוא keystore ישן ב-EAS credentials
2. ✅ אם נמצא - החלף והרץ build חדש
3. ❌ אם לא נמצא - Request upload key reset ב-Play Console
4. ⏳ חכה לאישור (2-3 ימים)
5. ✅ העלה את `app-release-v96.aab`

