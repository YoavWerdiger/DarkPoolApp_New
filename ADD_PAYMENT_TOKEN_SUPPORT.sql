-- ========================================
-- הוספת תמיכה ב-Token ל-Recurring Payments
-- ========================================

-- הוספת עמודת card_token לטבלת user_subscriptions
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS cardcom_token TEXT,
ADD COLUMN IF NOT EXISTS cardcom_token_exp_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS card_last4_digits TEXT,
ADD COLUMN IF NOT EXISTS card_brand TEXT;

-- הוספת אינדקס ל-token
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_token 
ON user_subscriptions(cardcom_token) 
WHERE cardcom_token IS NOT NULL;

-- הערות
COMMENT ON COLUMN user_subscriptions.cardcom_token IS 'Cardcom Token ל-recurring payments';
COMMENT ON COLUMN user_subscriptions.cardcom_token_exp_date IS 'תאריך תפוגה של ה-Token';
COMMENT ON COLUMN user_subscriptions.card_last4_digits IS '4 ספרות אחרונות של הכרטיס';
COMMENT ON COLUMN user_subscriptions.card_brand IS 'מותג הכרטיס (Visa, Mastercard, etc.)';

