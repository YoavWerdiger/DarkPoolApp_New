-- ========================================
-- עדכון תוכניות מנוי למסלולים חיים + LowProfile API
-- ========================================

-- הוספת עמודה ל-LowProfileId
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS cardcom_low_profile_id VARCHAR(255);

-- הוספת אינדקס ל-LowProfileId
CREATE INDEX IF NOT EXISTS idx_payment_transactions_low_profile_id 
ON payment_transactions(cardcom_low_profile_id);

-- מחיקת התוכניות הישנות
DELETE FROM subscription_plans WHERE id IN ('free', 'premium', 'pro');

-- הכנסת התוכניות החדשות - מסלולים חיים
INSERT INTO subscription_plans (id, name, description, price, period, features, role, popular) VALUES

-- מסלול חודשי
('monthly', 'מסלול חודשי', 'מסלול חיים חודשי עם גישה מלאה לכל התכונות', 99, 'monthly',
 '["גישה מלאה לכל התכונות", "אותות מסחר חיים", "ניתוחים מקצועיים", "תמיכה 24/7", "גישה לקהילה הפרימיום", "אותות בלעדיים", "עדכונים בזמן אמת"]'::jsonb,
 'premium_user', true),

-- מסלול רבעוני
('quarterly', 'מסלול רבעוני', 'מסלול חיים רבעוני עם הנחה משמעותית', 250, 'quarterly',
 '["כל התכונות של המסלול החודשי", "הנחה של 16%", "גישה מוקדמת לתכונות חדשות", "ייעוץ אישי חודשי", "אותות בלעדיים", "ניתוחים מותאמים אישית"]'::jsonb,
 'premium_user', false),

-- מסלול שנתי
('yearly', 'מסלול שנתי', 'מסלול חיים שנתי עם הנחה מקסימלית', 999, 'yearly',
 '["כל התכונות של המסלול הרבעוני", "הנחה של 16%", "גישה מוקדמת לתכונות חדשות", "ייעוץ אישי שבועי", "אותות בלעדיים", "ניתוחים מותאמים אישית", "גישה לחדר VIP", "מפגשים אישיים"]'::jsonb,
 'premium_user', false)

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    period = EXCLUDED.period,
    features = EXCLUDED.features,
    role = EXCLUDED.role,
    popular = EXCLUDED.popular,
    updated_at = NOW();

-- עדכון פונקציית חידוש מנוי לתמיכה בתקופות חדשות
CREATE OR REPLACE FUNCTION renew_expired_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    renewed_count INTEGER := 0;
    subscription_record RECORD;
BEGIN
    -- מצא מנויים שפגו תוקפם אבל יש להם auto_renew = true
    FOR subscription_record IN
        SELECT us.*, sp.price, sp.period
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.status = 'active' 
        AND us.expires_at <= NOW()
        AND us.auto_renew = true
    LOOP
        -- עדכן את תאריך התפוגה לפי התקופה
        UPDATE user_subscriptions 
        SET expires_at = CASE 
            WHEN subscription_record.period = 'monthly' THEN expires_at + INTERVAL '1 month'
            WHEN subscription_record.period = 'quarterly' THEN expires_at + INTERVAL '3 months'
            WHEN subscription_record.period = 'yearly' THEN expires_at + INTERVAL '1 year'
            ELSE expires_at + INTERVAL '1 month'
        END,
        updated_at = NOW()
        WHERE id = subscription_record.id;
        
        renewed_count := renewed_count + 1;
    END LOOP;
    
    RETURN renewed_count;
END;
$$ LANGUAGE plpgsql;

-- בדיקה שהתוכניות החדשות נוצרו
SELECT 'Updated subscription plans' as status, 
       id, name, price, period, popular 
FROM subscription_plans 
ORDER BY price;

-- הערות על התוכניות החדשות
COMMENT ON TABLE subscription_plans IS 'טבלת תוכניות מנוי חיים - מסלול חודשי, רבעוני ושנתי';
COMMENT ON COLUMN subscription_plans.period IS 'תקופת המנוי: monthly, quarterly, yearly';
COMMENT ON COLUMN subscription_plans.price IS 'מחיר המנוי בשקלים';
