# מדריך העלאה ל-Google Play

## לפני שמתחילים - דרישות מקדימות

### 1. חשבון Google Play Console
- צור חשבון Developer ב-Google Play Console: https://play.google.com/console
- תשלום חד-פעמי של $25 לתאריך פרסום

### 2. יצירת Service Account לשילוח אוטומטי

#### שלב 1: צור Service Account
1. כנס ל-Google Cloud Console: https://console.cloud.google.com
2. בחר את הפרויקט שלך או צור חדש
3. לך ל **IAM & Admin** → **Service Accounts**
4. לחץ על **Create Service Account**
5. מלא:
   - Name: `play-store-submitter`
   - Description: `Service account for EAS Submit`
6. לחץ **Create and Continue**

#### שלב 2: הוסף Key ל-Service Account
1. לחץ על ה-Service Account שיצרת
2. לך לטאב **Keys**
3. לחץ **Add Key** → **Create new key**
4. בחר **JSON** ולחץ **Create**
5. קובץ ה-JSON ירד אוטומטית

#### שלב 3: הגדר permissions ב-Google Play Console
1. כנס ל-Google Play Console
2. לך ל **Setup** → **API access**
3. לחץ על **Link a new project** (אם יש פרויקט קיים, לחץ **Manage**)
4. בחר את הפרויקט שיצרת
5. מצא את ה-Service Account שיצרת ולחץ **Grant access**
6. בחר תפקיד: **Admin (all permissions)**
7. הוסף את קובץ ה-JSON שיצרת לשם: `google-service-account-key.json` בשורש הפרויקט

## תהליך הבנייה וההגשה

### שלב 1: התקן EAS CLI (אם עוד לא עשית)
```bash
npm install -g eas-cli
```

### שלב 2: התחבר ל-EAS
```bash
eas login
```

### שלב 3: הגדר את הפרויקט שלך
```bash
eas build:configure
```

### שלב 4: ליצור AAB (Android App Bundle) עבור Google Play

**אפשרות A: בנייה עם הגשה אוטומטית**
```bash
eas build --platform android --profile production
```

**אפשרות B: בנייה והגשה בנפרד**

1. בנייה:
```bash
eas build --platform android --profile production
```

2. הגשה (לאחר יצירת Service Account):
```bash
eas submit --platform android --profile production
```

### שלב 5: עמוד על ה-Google Play Console

1. **קטגוריות של אפליקציות**
   - בחר **כל האפליקציות** → **צור אפליקציה חדשה**
   - שם אפליקציה: **DarkPool**
   - שפה ברירת מחדל: **עברית (ישראל)**
   - סוג אפליקציה: **App**
   - בחינם: **אה כן**
   - הודעה על התחייבות מנהלי מערכת: **אה כן**

2. **הצהרת פרטיות**
   - הצה כי האפליקציה או ההיסטוריה שלה (סטטיסטיקות) עולה בקנה אחד עם כל מדיניות Google Play
   - לחץ **צור**

3. **עמוד הניהול של האפליקציה**
   
   **א. תוכן**
   - הוסף **תמונה של אפליקציה** (512x512px)
   - הוסף **תמונה של כתב יד** (48dp, ה-transparency מומלץ)
   - הוסף **תמונה של כרטיס טבעי** (design your play store listing)
   - הוסף **תיאור קצר** (עד 80 תווים)
   - הוסף **תיאור מלא** (עד 4000 תווים)

   **ב. העסק**
   - הוסף **פרטי תקשורת**
   - הוסף **תמונת פרטיות**

4. **גרסאות**
   - לחץ **צור שחרור** באזור **Production**
   - העלה את קובץ ה-AAB שיצרת עם EAS
   - כתוב **הערות שחרור** (מה חדש בגרסה זו)
   - לחץ **שמור** ולאחר מכן **סקור שחרור**

5. **ציות**
   
   **א. תוכן**
   - כדאי לסמן את כל המודעות (אוכל, מין, תחרותי וכו')
   
   **ב. נתוני מטרה**
   - הגיב על מדיניות הפרטיות ושתף סיכום מדיניות הפרטיות

6. **Schedule and pricing**
   - בחר "Released" או "Staged rollout"

7. **Transitions available to users**
   - אם צריכה ירידה בגרסה, תבחר **no**

8. **סקור ואשר**
   - סקור הכל ולחץ **Start rollout to Production**

## הגדרות נוספות חשובות

### הסכמי ה-Developer
- וודא שנחתמו כל הסכמי ה-Developer:
  - IAP
  - Data
  - Others

### בדיקות לפני הגשת גרסה חדשה
```bash
# בדיקה מקומית
npm run android

# בניית preview לעריכה מקומית
eas build --platform android --profile preview
```

## תהליך עדכון גרסה חדשה

לאחר שחרור הגרסה הראשונה, לעדכון גרסה חדשה:

1. עדכן את `version` ב-`app.json` (לדוגמה: "1.0.1")
2. הפוך **build** חדש עם EAS
3. ב-Google Play Console, לך ל **Production** → **Create new release**
4. העלה את קובץ ה-AAB החדש
5. כתוב הערות שחרור
6. שמור והגש

## פתרון בעיות נפוצות

### שגיאה: "version code must be higher"
- עדכן את `versionCode` ב-`app.json` לערך גבוה יותר
- עשה rebuild

### שגיאה: "Keystore not found"
- EAS יוצר באופן אוטומטי את ה-keystore
- אם יש חשש, נגן ב:
```bash
eas credentials
```

### בנייה מקומית (ללא EAS)
אם אתה מעדיף לבנות מקומית:
```bash
cd android
./gradlew assembleRelease
./gradlew bundleRelease
```

## רזולוציות תמונות נדרשות

- **App Icon**: 512x512 px
- **Feature Graphic**: 1024x500 px
- **Phone Screenshot**: לפחות אחת, מומלץ 16:9 או 9:16
- **7-inch Tablet Screenshot**: אופציונלי
- **10-inch Tablet Screenshot**: אופציונלי

## קישורים שימושיים
- Google Play Console: https://play.google.com/console
- EAS Build: https://build.expo.dev
- EAS Documentation: https://docs.expo.dev/build/introduction/


















