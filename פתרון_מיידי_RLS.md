# 🚀 פתרון מיידי לשגיאת RLS

## הבעיה
- שגיאה: "Missing required fields" מה-Edge Function
- Supabase CLI לא מותקן במחשב

## ✅ הפתרון המיידי - שינוי מדיניות RLS

במקום להשתמש ב-Edge Function (שדורש התקנת CLI), נשנה את מדיניות ה-RLS כך שתאפשר למשתמשים מחוברים ליצור עסקאות.

### שלבי הפתרון:

#### 1. כנס ל-Supabase Dashboard
```
https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/editor
```

#### 2. פתח SQL Editor
לחץ על "SQL Editor" בתפריט הצד

#### 3. הרץ את הקוד הבא:

```sql
-- הסרת מדיניות ישנות
DROP POLICY IF EXISTS "Users can view their own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users can insert their own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users can update their own payment transactions" ON payment_transactions;

-- יצירת מדיניות חדשות שמאפשרות למשתמשים מחוברים

-- קריאה - רק למשתמש עצמו
CREATE POLICY "Users can view their own payment transactions" 
ON payment_transactions
FOR SELECT 
USING (auth.uid() = user_id);

-- הכנסה - מאפשר למשתמשים מחוברים ליצור רשומות
CREATE POLICY "Users can insert their own payment transactions" 
ON payment_transactions
FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (auth.uid() = user_id OR user_id IS NULL)
);

-- עדכון - למשתמש עצמו או למערכת
CREATE POLICY "Users can update their own payment transactions" 
ON payment_transactions
FOR UPDATE 
USING (
    auth.uid() = user_id 
    OR status = 'pending'
);

-- בדיקה
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'payment_transactions';
```

#### 4. חזור לקוד ושנה את paymentService.ts

עכשיו צריך לשנות את הקוד בחזרה להכנסה ישירה במקום Edge Function:


