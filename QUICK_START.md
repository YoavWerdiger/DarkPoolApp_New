# 🚀 הפעלה מהירה - מערכת הלמידה

## שלב 1: הגדרת מסד הנתונים

1. **פתח את Supabase Dashboard**
2. **עבור ל-SQL Editor**
3. **הפעל את הקבצים הבאים בסדר:**

```sql
-- 1. צור סכמה וטבלאות
\i learning_schema.sql

-- 2. הפעל מדיניות RLS
\i learning_rls_policies.sql

-- 3. הפעל מדיניות Storage
\i learning_storage_policies.sql

-- 4. הוסף נתוני דוגמה (אופציונלי)
\i learning_sample_data.sql
```

## שלב 2: הגדרת Storage

1. **עבור ל-Storage ב-Supabase**
2. **צור buckets חדשים:**
   - `course-media` (private)
   - `course-covers` (public)

## שלב 3: הגדרת Edge Functions

1. **התקן Supabase CLI:**
```bash
npm install -g supabase
```

2. **התחבר לפרויקט:**
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

3. **העלה Functions:**
```bash
supabase functions deploy get-signed-media-url
supabase functions deploy finalize-quiz
```

## שלב 4: הפעלת האפליקציה

1. **התקן תלויות:**
```bash
npm install
```

2. **הפעל את האפליקציה:**
```bash
npm start
```

3. **בחר פלטפורמה:**
   - `a` עבור Android
   - `i` עבור iOS
   - `w` עבור Web

## שלב 5: בדיקה

1. **פתח את האפליקציה**
2. **עבור לטאב "קורסים"**
3. **בדוק שהקורסים נטענים**
4. **נסה להירשם לקורס**
5. **בדוק נגן השיעורים**

## 🔧 פתרון בעיות נפוצות

### שגיאת "Unauthorized"
- בדוק שה-RLS policies הופעלו
- ודא שהמשתמש מחובר

### וידאו לא נטען
- בדוק שה-Edge Function הועלה
- ודא שה-bucket `course-media` קיים

### שגיאות TypeScript
- הרץ `npm install` שוב
- בדוק שהקבצים נשמרו נכון

## 📱 תכונות לבדיקה

- [ ] רשימת קורסים
- [ ] פרטי קורס
- [ ] הרשמה לקורס
- [ ] נגן וידאו
- [ ] מעקב התקדמות
- [ ] חידונים
- [ ] מסך "הלמידה שלי"

## 🎯 השלבים הבאים

1. **הוסף קורסים אמיתיים**
2. **העלה קבצי וידאו**
3. **צור חידונים**
4. **התאם אישית את העיצוב**
5. **הוסף תכונות נוספות**

---

**זמן הפעלה משוער**: 15-30 דקות  
**רמת קושי**: בינונית  
**דרישות**: Supabase project, Node.js, Expo CLI

