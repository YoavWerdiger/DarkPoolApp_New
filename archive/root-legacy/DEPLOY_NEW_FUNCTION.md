# 🚀 פריסת פונקציה חדשה - Economic Calendar Sync

## מה יצרנו?

פונקציה **חדשה לגמרי** בשם `sync-economic-calendar` שמחליפה את הישנה.

## ✅ יכולות הפונקציה:

- שולפת **כל** אירועי המאקרו הכלכליים מ-EODHD
- טווח: **3 חודשים אחורה + 3 קדימה** מיום ההרצה
- מקבלת **עד 1000 אירועים** (לא מוגבל ל-46)
- שומרת הכל בטבלה `economic_events`

## 📋 שלבי הפריסה:

### שלב 1: פתח Supabase Dashboard
לך ל: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions

### שלב 2: צור פונקציה חדשה
1. לחץ על **Create a new function**
2. שם הפונקציה: `sync-economic-calendar`
3. העתק את כל התוכן מ:
   ```
   /Users/yoavwerdiger/DarkPoolApp_New/DarkPoolApp_New/supabase/functions/sync-economic-calendar/index.ts
   ```
4. לחץ **Deploy**

### שלב 3: בדיקה
הרץ:
```bash
chmod +x test_new_sync.sh
bash test_new_sync.sh
```

אמור להחזיר:
```json
{
  "success": true,
  "total": 500+,
  "range": "2025-07-11 to 2026-01-11",
  "today": X,
  "highImportance": Y
}
```

### שלב 4: עדכן את הקוד באפליקציה (אם צריך)
במקום לקרוא ל-`daily-economic-sync-simple`, קרא ל-`sync-economic-calendar`.

### שלב 5: רענן אפליקציה
סגור ופתח מחדש.

## 🎯 מה צפוי לקרות:

היומן יהיה **מלא** באירועים:
- ✅ אירועים מהשבוע הבא (13-18 אוקטובר)
- ✅ אירועים מנובמבר (NFP, CPI, etc.)
- ✅ אירועים מדצמבר
- ✅ סה"כ מאות אירועים במקום 46!

## 🔄 מחק את הישנה (אופציונלי)
אחרי שהחדשה עובדת, אפשר למחוק את `daily-economic-sync-simple` הישנה.


