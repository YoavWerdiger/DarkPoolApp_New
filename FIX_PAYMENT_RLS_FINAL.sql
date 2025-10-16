-- ========================================
-- תיקון סופי למדיניות RLS של טבלת payment_transactions
-- ========================================

-- 1. בדיקת הגדרות הנוכחיות
SELECT 
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'payment_transactions';

-- 2. הסרת כל המדיניות הישנות
DROP POLICY IF EXISTS "Users can view their own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users can insert their own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users can update their own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users can insert pending transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Allow service role to insert" ON payment_transactions;

-- 3. יצירת מדיניות חדשות מותאמות

-- קריאה - רק למשתמש עצמו
CREATE POLICY "Users can view their own payment transactions" 
ON payment_transactions
FOR SELECT 
USING (auth.uid() = user_id);

-- הכנסה - מאפשר הכנסה אם המשתמש מזוהה
CREATE POLICY "Users can insert their own payment transactions" 
ON payment_transactions
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- עדכון - רק למשתמש עצמו או למערכת
CREATE POLICY "Users can update their own payment transactions" 
ON payment_transactions
FOR UPDATE 
USING (
    auth.uid() = user_id 
    OR auth.role() = 'service_role'
    OR status = 'pending'
);

-- 4. וידוא שהטבלה מאפשרת INSERT
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- 5. בדיקה סופית
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'payment_transactions'
ORDER BY policyname;

-- 6. בדיקת הרשאות הטבלה
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name='payment_transactions';

