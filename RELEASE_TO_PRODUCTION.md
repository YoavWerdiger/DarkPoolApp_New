# מדריך שחרור גרסה ל-Production

## הבעיה: גרסה לא מופיעה למשתמשים

אם העלאת גרסה חדשה אבל המשתמשים לא רואים עדכון, זה כנראה כי הגרסה נמצאת ב-**Internal Testing** ולא ב-**Production**.

## פתרון מהיר

### אפשרות 1: דרך Google Play Console (מומלץ)

1. **כנס ל-Google Play Console**: https://play.google.com/console
2. **בחר את האפליקציה שלך**
3. **לך ל-Production** (בסרגל הצד השמאלי)
4. **לחץ על "Create new release"** (אם אין גרסה קיימת) או **"Edit release"** (אם יש גרסה ב-draft)
5. **העלה את קובץ ה-AAB החדש** (אם עוד לא העלית)
6. **כתוב הערות שחרור** (release notes) בעברית ובאנגלית
7. **שמור** (Save)
8. **לחץ על "Review release"** → **"Start rollout to Production"**

### אפשרות 2: העברת גרסה מ-Internal ל-Production

אם העלאת ל-Internal Testing בטעות:

1. **כנס ל-Google Play Console**
2. **לך ל-Production**
3. **לחץ "Create new release"**
4. **במקום להעלות קובץ חדש, לחץ על "Copy from internal testing"** (אם יש לך כפתור כזה)
5. **או העלה את אותו קובץ AAB שוב**
6. **שחרר ל-Production**

### אפשרות 3: עדכון track ב-eas.json (להעלאות עתידיות)

עדכנתי את ה-`eas.json` כך שה-track יהיה `"production"` ולא `"internal"`.

**להעלאה הבאה:**
```bash
eas build --platform android --profile production
eas submit --platform android --profile production
```

## בדיקות לפני שחרור

לפני שחרור ל-Production, כדאי לבדוק:

1. ✅ **בדוק שהגרסה רצה על אמולטור/מכשיר**
2. ✅ **בדוק שהגרסה לא קורסת בפתיחה**
3. ✅ **בדוק שכל התכונות עובדות**
4. ✅ **בדוק שהעדכון לא שובר תאימות לאחור**

## תהליך שחרור מלא

### 1. בניית הגרסה
```bash
eas build --platform android --profile production
```

### 2. בדיקת הגרסה (אופציונלי)
- הורד את ה-AAB מה-EAS dashboard
- התקן על מכשיר/אמולטור לבדיקה

### 3. הגשת הגרסה
```bash
eas submit --platform android --profile production
```
או דרך Google Play Console ידנית.

### 4. שחרור ב-Google Play Console

**חשוב:** גם אם השתמשת ב-`eas submit`, תצטרך לשחרר ידנית:

1. כנס ל-Google Play Console
2. לך ל-**Production**
3. אם יש גרסה ב-**"Draft"** - לחץ **"Review release"**
4. לחץ **"Start rollout to Production"**

## Staged Rollout (שחרור הדרגתי)

אם אתה רוצה לשחרר בהדרגה (מומלץ לגרסאות ראשונות):

1. ב-**"Review release"** בחר **"Staged rollout"**
2. בחר **אחוז משתמשים** (5%, 10%, 20%, וכו')
3. המתן כמה ימים לבדוק שאין בעיות
4. אם הכל תקין, **"Increase rollout"** או **"Release to everyone"**

## חשוב לדעת

- **Internal Testing**: רק משתמשים שברשימת בדיקה
- **Closed Testing**: רק משתמשים בקבוצת בדיקה סגורה
- **Open Testing**: כל מי שיודע על הקישור
- **Production**: **כל המשתמשים בחנות** ✅

אם אתה רוצה שהגרסה תופיע למשתמשים הרגילים, **חייב להיות ב-Production!**

## עדכון versionCode

לכל גרסה חדשה, עדכן:
- `versionCode` ב-`app.json` (חייב להיות גבוה יותר)
- `version` ב-`app.json` (לדוגמה: "1.0.1" → "1.0.2")

עכשיו ה-`versionCode` הוא **3**, אז אם תרצה גרסה נוספת - שנה ל-**4**.


