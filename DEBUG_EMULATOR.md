# מדריך פתרון בעיות אמולטור

## מה לעשות אם האפליקציה לא רצה על האמולטור:

### 1. בדוק שהאמולטור פתוח
   - פתח Android Studio
   - פתח Device Manager
   - וודא שיש אמולטור שרץ (state: Running)
   - אם לא, לחץ על ה-Play לצידו

### 2. הפעל את האפליקציה דרך Terminal

**אפשרות א': עם Expo Go**
```bash
npx expo start --clear
```
ואז:
- לחץ `a` להפעלה על Android
- או סרוק את ה-QR עם Expo Go באמולטור

**אפשרות ב': עם Build מקומי (מומלץ)**
```bash
npx expo run:android
```
זה יבנה את האפליקציה ישירות על האמולטור.

### 3. בדוק שגיאות בקונסול

אם יש שגיאות, תבדוק:
- שגיאות באדום = שגיאת קומפילציה/סינטקס
- אזהרות בכתום = אזהרות שלא אמורות לעצור את ההרצה

### 4. בדוק את הלוגים

בטרמינל תראה:
```
› Metro waiting on exp://...
› Scan the QR code above with Expo Go (Android) or the Expo Go app (iOS)
```

אם אתה רואה שגיאות, העתק אותן ובדוק.

### 5. טיפים נוספים

**נקה את הקאש:**
```bash
npx expo start --clear
```

**נקה את node_modules:**
```bash
rm -rf node_modules
npm install
```

**בדוק שהפורט פנוי:**
```bash
lsof -i :8081
```
אם יש תהליך, סגור אותו או הפעל עם פורט אחר:
```bash
npx expo start --android --port 8084
```

### 6. אם כלום לא עובד

נסה להריץ את האפליקציה ישירות:
```bash
cd android
./gradlew clean
cd ..
npx expo run:android
```

## שגיאות נפוצות ופתרונות

**"Could not connect to development server"**
- בדוק שה-Metro bundler רץ
- נסה `adb reverse tcp:8081 tcp:8081`

**"Unable to load script"**
- נקה את הקאש: `npx expo start --clear`
- הפעל מחדש את האמולטור

**"Application crashed"**
- בדוק את הלוגים בקונסול
- בדוק את הלוגים באמולטור עצמו (logcat)


