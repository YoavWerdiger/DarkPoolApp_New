# 🚀 תיקון מהיר - שגיאת תשלומים

## 📋 הבעיה
```
ERROR: new row violates row-level security policy for table "payment_transactions"
Function responded with 400 Missing required fields
```

## ✅ הפתרון (3 דקות)

### שלב 1: פתח את Supabase Dashboard
1. לך ל: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime
2. לחץ על **"SQL Editor"** בצד שמאל

### שלב 2: הרץ את קוד התיקון
1. לחץ על **"+ New query"**
2. העתק והדבק את כל התוכן מהקובץ: `תיקון_מיידי_RLS.sql`
3. לחץ על **"Run"** (או Ctrl+Enter)
4. ודא שאין שגיאות

### שלב 3: בדוק שהכל עובד
1. פתח את האפליקציה מחדש
2. נסה ליצור תשלום חדש
3. **התוצאה המצופה:**
   - ✅ אין שגיאת RLS
   - ✅ הטרנזקציה נשמרת בהצלחה
   - ✅ מופיע מסך תשלום של CardCom

---

## 🔧 מה השתנה?

### 1. בקוד (paymentService.ts)
הקוד עכשיו מנסה שני אופציות:
- **אופציה 1:** Edge Function (אם קיים)
- **אופציה 2:** הכנסה ישירה (fallback)

### 2. במסד הנתונים (RLS Policies)
שינינו את המדיניות כך שמשתמשים מחוברים יכולים ליצור עסקאות.

---

## 📊 בדיקה נוספת (אופציונלי)

אחרי שהרצת את קוד ה-SQL, בדוק שהמדיניות שונתה:

```sql
SELECT 
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'payment_transactions';
```

**צריך להציג:**
- ✅ Users can view their own payment transactions (SELECT)
- ✅ Authenticated users can insert payment transactions (INSERT)
- ✅ Users can update their own or pending transactions (UPDATE)

---

## ⚠️ אם עדיין יש בעיה

1. **בדוק את הלוגים:** חפש הודעות מ-PaymentService
2. **ודא שאתה מחובר:** בדוק ש-`auth.uid()` לא null
3. **בדוק את העמודות:** ודא ש-`payment_transactions` מכילה את כל העמודות הנדרשות

---

## 💡 הסבר טכני

**למה זה קרה?**
- מדיניות ה-RLS הקודמת דרשה התאמה מדויקת: `auth.uid() = user_id`
- הקוד רץ עם `anon_key` שלא מאפשר הכנסות ישירות
- Edge Function לא היה פרוס בגלל שה-CLI לא מותקן

**מה הפתרון עשה?**
- שינה את המדיניות לאפשר למשתמשים מחוברים ליצור עסקאות
- הוסיף fallback להכנסה ישירה אם Edge Function לא זמין
- הוסיף logging מפורט לזיהוי בעיות

---

**נוצר:** 16 אוקטובר 2025  
**זמן משוער:** 3 דקות  
**סטטוס:** ✅ מוכן להרצה

