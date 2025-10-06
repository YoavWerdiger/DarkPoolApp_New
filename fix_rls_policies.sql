-- ========================================
-- תיקון RLS Policies עבור תשלומים במהלך רישום
-- ========================================

-- מחיקת ה-policy הישן
DROP POLICY IF EXISTS "Users can insert their own payment transactions" ON payment_transactions;

-- יצירת policy חדש שמאפשר הכנסת עסקאות עם user_id null (במהלך רישום)
CREATE POLICY "Users can insert their own payment transactions or pending transactions" ON payment_transactions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR 
        user_id IS NULL
    );

-- הוספת policy לעדכון עסקאות pending (כאשר המשתמש נרשם)
CREATE POLICY "Users can update pending payment transactions" ON payment_transactions
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        user_id IS NULL
    );

-- בדיקה שה-policies נוצרו
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'payment_transactions'
ORDER BY policyname;