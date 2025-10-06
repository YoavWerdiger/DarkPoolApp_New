-- ========================================
-- תיקון user_id בטבלת payment_transactions
-- ========================================

-- שינוי user_id לאפשר NULL (למקרים של תשלום במהלך רישום)
ALTER TABLE payment_transactions 
ALTER COLUMN user_id DROP NOT NULL;

-- הוספת הערה על השינוי
COMMENT ON COLUMN payment_transactions.user_id IS 'מזהה משתמש - יכול להיות NULL במהלך רישום';

-- בדיקה שהשינוי בוצע
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'payment_transactions' 
AND column_name = 'user_id';
