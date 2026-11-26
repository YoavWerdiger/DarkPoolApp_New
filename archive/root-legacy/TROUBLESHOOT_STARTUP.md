# פתרון בעיות התחלה

## הבעיה: האפליקציה נסגרת מיד אחרי פתיחה

### צעד 1: בדוק שהאמולטור פתוח ומזוהה

1. פתח Android Studio
2. פתח Device Manager (Tools → Device Manager)
3. לחץ על ה-Play לצד אמולטור (או צור חדש)
4. המתן שהאמולטור יפתח לגמרי

### צעד 2: הרץ את האפליקציה

**אפשרות א': עם Expo Go (מהיר יותר לבדיקה)**
```bash
npx expo start --clear
```
ואז לחץ `a` להפעלה על Android

**אפשרות ב': Build מקומי (איטי יותר אבל יציב)**
```bash
npx expo run:android
```

### צעד 3: אם האפליקציה עדיין נסגרת מיד

בדוק את הלוגים:
```bash
# בטרמינל של Expo תראה שגיאות
# או פתח Logcat ב-Android Studio:
# View → Tool Windows → Logcat
```

שגיאות נפוצות:
- `NoClassDefFoundError` - בעיה ב-build, נסה לנקות:
  ```bash
  cd android
  ./gradlew clean
  cd ..
  npx expo run:android
  ```

- `RuntimeException` - בדוק את הלוגים ב-Logcat

### צעד 4: ניקוי מלא (אם כלום לא עובד)

```bash
# נקה את node_modules
rm -rf node_modules package-lock.json
npm install

# נקה את ה-build של Android
cd android
./gradlew clean
rm -rf .gradle app/build
cd ..

# נקה את הקאש של Expo
npx expo start --clear --reset-cache

# או הרץ build מחדש
npx expo run:android
```

## אם אתה משתמש ב-Expo Go

1. ודא שהאפליקציה Expo Go מותקנת על האמולטור
2. הרץ `npx expo start`
3. לחץ `a` או סרוק את ה-QR
4. האפליקציה תתקין ותפתח

## אם אתה בונה גרסה מקומית

1. ודא שיש לך:
   - Android Studio מותקן
   - Android SDK מותקן
   - אמולטור מוגדר

2. הרץ:
   ```bash
   npx expo run:android
   ```

זה יבנה את האפליקציה מ-scratch ויתקין אותה על האמולטור.


