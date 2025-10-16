-- ========================================
-- תיקון סופי - הפיכת user_id ל-nullable
-- ========================================

-- 1. שינוי user_id לאפשר NULL
ALTER TABLE payment_transactions 
ALTER COLUMN user_id DROP NOT NULL;

-- 2. בדיקה שהשינוי בוצע
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'payment_transactions' 
AND column_name IN ('user_id', 'cardcom_low_profile_id')
ORDER BY column_name;



