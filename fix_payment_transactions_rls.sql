-- ========================================
-- תיקון טבלת payment_transactions
-- ========================================

-- 1. הוספת עמודה ל-LowProfile ID
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS cardcom_low_profile_id TEXT;

-- 2. הסרת מדיניות ישנות
DROP POLICY IF EXISTS "Users can view their own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users can insert their own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users can update their own payment transactions" ON payment_transactions;

-- 3. יצירת מדיניות חדשות שמתירות גם user_id = NULL (למקרה של רישום)

-- קריאה - רק למשתמש עצמו
CREATE POLICY "Users can view their own payment transactions" ON payment_transactions
    FOR SELECT USING (
        auth.uid() = user_id 
        OR user_id IS NULL
    );

-- הכנסה - רק למשתמש עצמו או NULL
CREATE POLICY "Users can insert their own payment transactions" ON payment_transactions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id 
        OR user_id IS NULL
    );

-- עדכון - רק למשתמש עצמו
CREATE POLICY "Users can update their own payment transactions" ON payment_transactions
    FOR UPDATE USING (
        auth.uid() = user_id 
        OR user_id IS NULL
    );

-- 4. יצירת אינדקס ל-LowProfile ID
CREATE INDEX IF NOT EXISTS idx_payment_transactions_low_profile_id 
ON payment_transactions(cardcom_low_profile_id);

-- 5. בדיקת המבנה
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'payment_transactions'
ORDER BY ordinal_position;

-- 6. בדיקת המדיניות
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
WHERE tablename = 'payment_transactions';



