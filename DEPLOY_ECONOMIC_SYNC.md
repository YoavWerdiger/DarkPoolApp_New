# 🚀 הוראות פריסה - Economic Calendar Sync

## הבעיה
הפונקציה `daily-economic-sync-simple` ב-Supabase לא מעודכנת.
הקובץ המקומי מעודכן, אבל השינויים לא פרוסים.

## הפתרון - פריסה ידנית

### שלב 1: פתח את Supabase Dashboard
לך ל: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions

### שלב 2: ערוך את הפונקציה
1. לחץ על `daily-economic-sync-simple`
2. לחץ על **Edit** או **Deploy new version**
3. **מחק את כל הקוד הקיים**

### שלב 3: העתק את הקוד החדש
פתח את הקובץ המקומי:
```
/Users/yoavwerdiger/DarkPoolApp_New/DarkPoolApp_New/supabase/functions/daily-economic-sync-simple/index.ts
```

העתק את **כל התוכן** (Cmd+A, Cmd+C)

### שלב 4: הדבק ופרוס
1. הדבק את הקוד ב-Supabase (Cmd+V)
2. לחץ **Deploy** או **Save**
3. חכה עד שהפריסה מסתיימת

### שלב 5: בדיקה
הרץ בטרמינל:
```bash
bash test_simple_function.sh
```

אם הפריסה הצליחה, תראה בתגובה:
- ✅ `"nextEventDate"` - שדה חדש
- ✅ מספר אירועים שונה
- ✅ לא יהיה `"earningsCount"` (זה היה בטעות)

## מה הפונקציה עושה
✅ שולפת אירועי מאקרו כלכליים (CPI, NFP, FOMC, GDP, etc.)
✅ טווח: 3 חודשים אחורה + 3 חודשים קדימה
✅ רק מ-EODHD - ללא FRED
✅ ללא placeholders - רק אירועים אמיתיים

## אם עדיין לא עובד
תודיע לי ואני אעזור לדבג!




