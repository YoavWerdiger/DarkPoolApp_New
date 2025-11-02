# פתרון קריסות ב-Production (מהחנות)

## הבעיה: האפליקציה רצה על אמולטור אבל קורסת מהחנות

### סיבות אפשריות:

1. **הגרסה לא התעדכנה למשתמשים**
   - משתמשים מורידים גרסה ישנה
   - Google Play לא עדכן את המשתמשים

2. **הבדלים בין Debug ל-Release Build**
   - Minification/ProGuard עלולים לשבור קוד
   - console.log/error עלולים לגרום לבעיות
   - Hermes vs JSC יכול להיות שונה

3. **בעיות באתחול**
   - שגיאות ב-first render
   - בעיות עם native modules
   - בעיות עם network calls

## פתרונות:

### 1. ודא שהמשתמשים מורידים את הגרסה החדשה

**ב-Google Play Console:**
1. לך ל-**Internal Testing** → **Testers**
2. ודא שהמשתמשים ברשימת הבדיקה
3. שלח להם קישור חדש להורדה
4. או בקש מהם למחוק את האפליקציה ולהתקין מחדש

**בדיקה:**
- בקש מהמשתמשים לבדוק את ה-versionCode
- בדוק ב-Google Play Console איזה גרסה יש להם

### 2. בדוק שאתה בונה release build

כשאתה בונה ל-Internal Testing, ודא שזה **release build** ולא debug:

```bash
eas build --platform android --profile production
```

או אם אתה בונה preview:
```bash
eas build --platform android --profile preview
```

**אל תשתמש ב-development profile** - זה debug build שלא מתאים ל-production.

### 3. בדוק את הלוגים

**דרך 1: Firebase Crashlytics (מומלץ)**
- הוסף Firebase Crashlytics לפרויקט
- תקבל דוחות קריסות אוטומטיים

**דרך 2: Logcat**
- בקש מהמשתמשים לשלוח logcat
- או התקן על מכשיר פיזי ובדוק

**דרך 3: Sentry**
- הוסף Sentry לפרויקט
- תקבל דוחות שגיאות מפורטים

### 4. הוסף יותר הגנות

עדכנתי את הקוד כך ש:
- `console.error` ב-ErrorBoundary רץ רק ב-__DEV__
- הוספתי try-catch בכל מקום קריטי
- ErrorBoundary מטפל בשגיאות React

### 5. בדוק ProGuard rules

אם minification מופעל, ודא שיש proguard-rules:
```proguard
# React Native
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
```

### 6. בדיקה מהירה - הוסף version לספלאש

כדי לדעת אם המשתמשים מורידים את הגרסה החדשה:

במקום ספלאש רגיל, הוסף טקסט עם version:
```tsx
<Text>Version {Constants.expoConfig?.version || '1.0.0'}</Text>
```

### 7. שחרר ב-Staged Rollout

אם עדיין לא בטוח:
1. שחרר ל-**5% משתמשים** קודם
2. המתן יום-יומיים
3. אם הכל תקין, **הגדל ל-100%**

## מה עכשיו?

1. **בדוק ב-Google Play Console:**
   - איזה גרסה מועלית?
   - מה ה-versionCode?
   - האם המשתמשים באמת במחזור הבדיקה?

2. **בקש מהמשתמשים:**
   - למחוק את האפליקציה לחלוטין
   - להוריד מחדש מהקישור של Internal Testing
   - לשלוח screenshot של המסך עם השגיאה (אם יש)

3. **בנה release build חדש:**
   ```bash
   eas build --platform android --profile production --clear-cache
   ```

4. **העלה ל-Internal Testing שוב:**
   ```bash
   eas submit --platform android --profile production --latest
   ```

## טיפים נוספים:

- **אל תשתמש ב-debug keystore** ב-production (אבל זה אמור להיות אוטומטי ב-EAS)
- **ודא שה-versionCode** עולה בכל גרסה
- **בדוק שהכל עובד** גם ב-release build מקומי לפני העלאה


