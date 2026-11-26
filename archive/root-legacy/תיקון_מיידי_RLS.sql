-- =============================================
-- תיקון מיידי למדיניות RLS של טבלת payment_transactions
-- הרץ את הקוד הזה ב-Supabase SQL Editor
-- =============================================

-- 1. הסרת מדיניות ישנות
DROP POLICY IF EXISTS "Users can view their own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users can insert their own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users can update their own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users can insert pending transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON payment_transactions;

-- 2. יצירת מדיניות חדשות

-- קריאה - רק למשתמש עצמו
CREATE POLICY "Users can view their own payment transactions" 
ON payment_transactions
FOR SELECT 
USING (auth.uid() = user_id);

-- הכנסה - מאפשר למשתמשים מחוברים ליצור רשומות
CREATE POLICY "Authenticated users can insert payment transactions" 
ON payment_transactions
FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (
        auth.uid() = user_id 
        OR user_id IS NULL
        OR status = 'pending'
    )
);

-- עדכון - למשתמש עצמו או לעסקאות ממתינות
CREATE POLICY "Users can update their own or pending transactions" 
ON payment_transactions
FOR UPDATE 
USING (
    auth.uid() = user_id 
    OR status = 'pending'
);

-- 3. וידוא שהטבלה מאפשרת RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- 4. בדיקה - צריך להציג 3 מדיניות
SELECT 
    policyname,
    cmd,
    SUBSTRING(qual::text FROM 1 FOR 50) as condition_preview,
    SUBSTRING(with_check::text FROM 1 FOR 50) as check_preview
FROM pg_policies
WHERE tablename = 'payment_transactions'
ORDER BY cmd, policyname;

-- 5. הצג את כל העמודות בטבלה
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'payment_transactions'
ORDER BY ordinal_position;

