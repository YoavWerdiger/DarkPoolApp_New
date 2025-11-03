# בדיקת Keystores ב-EAS

## הבעיה
יש לנו **2 keystores שונים** ב-EAS:

### Keystore 1 (הנכון - SHA1: 37:BA...)
- Build: `317a7206` (version 6) - Nov 3, 00:25
- Build: `40956f0a` (version 8) - Nov 3, 10:20 ✅
- **זה ה-keystore שPlay Console מצפה לו!**

### Keystore 2 (החדש - SHA1: A1:7F...)
- Build: `e6001347` (version 95) - Nov 3, 12:18
- **זה keystore חדש שEAS יצר**

---

## הפתרון

צריך **לבדוק אילו keystores יש** ולהחליף ל-keystore הנכון.

### אופציה 1: בדיקה דרך Web Console
1. עבור ל: https://expo.dev/accounts/darkpoolapp/projects/DarkPool/credentials
2. בדוק **Android Keystores**
3. ראה אם יש שניים

### אופציה 2: שאל תמיכת EAS
כנראה ש-EAS יצר keystore חדש בטעות בין build 8 ל-build 95.

---

## פתרון זמני - העלה את Version 8

הקובץ מוכן:
```
/Users/yoavwerdiger/DarkPoolApp_New-1/app-release-version-8.aab
```

**בעיה**: Version code הוא 8, אבל Play Console מצפה ל-96+

---

## הפתרון הטוב ביותר

**הריצו build חדש אבל בחרו את ה-keystore הנכון:**

```bash
npx eas-cli build --platform android --profile production
```

כשEAS שואל **"Which build profile do you want to configure?"**:
- בחר את ה-keystore עם SHA1: `37:BA:6E:E4...`

