# בניית AAB עם Android Studio

## שלב 1: הכנה
```bash
cd /Users/yoavwerdiger/DarkPoolApp_New-1
npm install --legacy-peer-deps
npx expo prebuild --platform android --clean
```

## שלב 2: פתח ב-Android Studio
1. פתח Android Studio
2. File → Open
3. בחר את התיקייה: `/Users/yoavwerdiger/DarkPoolApp_New-1/android`
4. המתן שGradle Sync יסתיים

## שלב 3: צור Keystore חדש (פעם אחת)
1. Build → Generate Signed Bundle / APK
2. בחר "Android App Bundle"
3. לחץ "Create new..."
4. **שמור את הפרטים האלה במקום בטוח:**
   - Key store path: `/Users/yoavwerdiger/darkpool-release-key.jks`
   - Password: [בחר סיסמה חזקה]
   - Alias: darkpool
   - Key password: [אותה סיסמה]
   - Validity: 25 שנים
   - שם: DarkPool App
   
5. שמור את ה-keystore!

## שלב 4: בנה את ה-AAB
1. Build → Generate Signed Bundle / APK
2. בחר "Android App Bundle"  
3. בחר את ה-Keystore שיצרת
4. הזן את הסיסמאות
5. Build variant: **release**
6. ✅ סמן: "Export encrypted key for enrolling published apps..."
7. לחץ "Finish"

## שלב 5: מצא את הקבצים
אחרי Build מוצלח:
- **AAB**: `android/app/build/outputs/bundle/release/app-release.aab`
- **Mapping**: `android/app/build/outputs/mapping/release/mapping.txt`
- **Upload key**: הקובץ שנוצר עם .pepk

## שלב 6: העלאה ל-Play Console
1. לך ל-Play Console
2. Production → Create new release
3. העלה את ה-AAB
4. העלה את ה-mapping.txt (אופציונלי אבל מומלץ)
5. העלה את ה-upload key (.pepk) אם זה keystore חדש
6. פרסם!

---

## 💾 גיבוי חשוב!
שמור את ה-keystore (`.jks`) והסיסמאות במקום **מאוד בטוח**!
אם תאבד אותו, לא תוכל לעדכן את האפליקציה בעתיד!


