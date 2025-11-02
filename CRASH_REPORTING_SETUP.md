# הגדרת דיווח קריסות ב-Google Play Console

## מה עשינו:

1. **הפעלנו R8/ProGuard** - עכשיו הקוד מתקמפל עם code shrinking ו-obfuscation
2. **שיפרנו ProGuard rules** - הוספנו כללים חשובים ל-React Native, Expo, Supabase
3. **קובץ mapping נוצר אוטומטית** - בכל build של production, EAS יוצר `mapping.txt`

## איך זה עובד:

### 1. כשאתה בונה build חדש:
```bash
eas build --platform android --profile production
```

EAS Build יצור:
- ✅ `app-release.aab` - האפליקציה שלך
- ✅ `mapping.txt` - קובץ deobfuscation (יהיה זמין ב-build artifacts)

### 2. העלאה ל-Google Play Console:

**אופציה A: העלאה ידנית (עם mapping)**
1. לחץ על **"App Bundle"** באפליקציה שלך
2. בחר **"Upload new release"**
3. העלה את ה-`.aab` file
4. **חשוב:** העלה גם את `mapping.txt`:
   - לך ל-EAS Build dashboard
   - הורד את `mapping.txt` מה-build artifacts
   - ב-Google Play Console, אחרי העלאת ה-AAB, יופיע שדה להעלאת `mapping.txt`
   - העלה אותו שם

**אופציה B: העלאה אוטומטית עם EAS Submit**
```bash
eas submit --platform android --latest
```

EAS Submit אמור להעלות את ה-mapping אוטומטית, אבל לפעמים צריך לעשות זאת ידנית.

### 3. איפה לראות את הקריסות:

1. לך ל-**Google Play Console**
2. בחר את האפליקציה שלך
3. תפריט צד: **"Quality"** → **"Android vitals"** → **"Crashes & ANRs"**
4. שם תראה:
   - רשימת כל הקריסות
   - מספר המשתמשים שנפגעו
   - Stack traces מפורטים בקוד המקורי (בזכות ה-mapping)
   - מידע על ANR (App Not Responding)

### 4. מה תראה בדוחות:

**לפני (בלי mapping):**
```
at com.darkpool.app.a.b(Unknown Source)
at com.darkpool.app.c.d(Unknown Source:42)
```

**אחרי (עם mapping):**
```
at com.darkpool.app.AuthContext.initializeAuth(AuthContext.tsx:94)
at com.darkpool.app.services.authService.getUserProfile(authService.ts:320)
```

## בדיקה שזה עובד:

1. אחרי build חדש, בדוק ב-EAS Build dashboard שיש `mapping.txt`
2. אחרי העלאה ל-Google Play Console, בדוק ש-Hero Image מוצג (זה אומר שה-mapping הועלה)
3. אחרי כמה ימים, בדוק ב-"Crashes & ANRs" אם אתה רואה קריסות מפורטות

## הערות חשובות:

⚠️ **כל build צריך את ה-mapping שלו** - לא ניתן להשתמש ב-mapping מ-build קודם!

✅ **שמור את כל ה-mapping files** - שמור אותם ב-build artifacts של EAS או בה-Git tags

✅ **Build size יקטן** - R8 מקטין את גודל האפליקציה ב-20-40% בדרך כלל

✅ **Performance יכול להשתפר** - Code shrinking משפר את זמן ההפעלה

## אם יש בעיות:

אם אחרי build אתה רואה שגיאות ProGuard, זה אומר שצריך להוסיף עוד rules. פשוט הוסף אותם ל-`android/app/proguard-rules.pro`.

