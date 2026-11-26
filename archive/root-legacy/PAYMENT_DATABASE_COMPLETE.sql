-- ========================================
-- מערכת תשלום ומנויים - סכמה מלאה
-- ========================================

-- טבלת תוכניות מנוי
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    period TEXT NOT NULL DEFAULT 'monthly', -- monthly, yearly
    features JSONB DEFAULT '[]'::jsonb,
    role TEXT NOT NULL, -- free_user, premium_user, pro_user
    popular BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- טבלת עסקאות תשלום
CREATE TABLE IF NOT EXISTS payment_transactions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'ILS',
    status TEXT NOT NULL DEFAULT 'pending', -- pending, success, failed, cancelled
    cardcom_transaction_id TEXT,
    payment_url TEXT,
    callback_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- טבלת מנויי משתמשים
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
    status TEXT NOT NULL DEFAULT 'active', -- active, cancelled, expired
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    auto_renew BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- הוספת עמודות מנוי לטבלת המשתמשים
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_role TEXT DEFAULT 'free_user',
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;

-- הוספת אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at ON user_subscriptions(expires_at);

-- הכנסת תוכניות מנוי בסיסיות
INSERT INTO subscription_plans (id, name, description, price, period, features, role, popular) VALUES
('free', 'חינם', 'תוכנית בסיסית עם תכונות מוגבלות', 0, 'monthly', 
 '["גישה לקהילה הבסיסית", "עדכונים יומיים", "תמיכה מוגבלת", "גישה למסלול מתחילים"]'::jsonb, 
 'free_user', false),

('premium', 'פרימיום', 'תוכנית מתקדמת עם תכונות מלאות', 99, 'monthly',
 '["כל התכונות החינמיות", "אותות מסחר מתקדמים", "ניתוחים מקצועיים", "תמיכה 24/7", "גישה לכל המסלולים", "אותות בלעדיים"]'::jsonb,
 'premium_user', true),

('pro', 'פרו', 'תוכנית מקצועית עם ייעוץ אישי', 199, 'monthly',
 '["כל התכונות הפרימיום", "ייעוץ אישי", "אותות בלעדיים", "ניתוחים מותאמים אישית", "גישה לחדר VIP", "מפגשים אישיים"]'::jsonb,
 'pro_user', false)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    period = EXCLUDED.period,
    features = EXCLUDED.features,
    role = EXCLUDED.role,
    popular = EXCLUDED.popular,
    updated_at = NOW();

-- פונקציה לעדכון תאריך עדכון אוטומטי
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- טריגרים לעדכון תאריך עדכון אוטומטי
CREATE TRIGGER update_subscription_plans_updated_at 
    BEFORE UPDATE ON subscription_plans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at 
    BEFORE UPDATE ON payment_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at 
    BEFORE UPDATE ON user_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- פונקציה לבדיקת מנוי פעיל
CREATE OR REPLACE FUNCTION get_user_active_subscription(user_uuid UUID)
RETURNS TABLE (
    subscription_id UUID,
    plan_id TEXT,
    plan_name TEXT,
    plan_price INTEGER,
    plan_role TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    days_remaining INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        us.id as subscription_id,
        us.plan_id,
        sp.name as plan_name,
        sp.price as plan_price,
        sp.role as plan_role,
        us.expires_at,
        EXTRACT(DAY FROM (us.expires_at - NOW()))::INTEGER as days_remaining
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = user_uuid 
    AND us.status = 'active' 
    AND us.expires_at > NOW()
    ORDER BY us.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- פונקציה לחידוש מנוי אוטומטי
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
        -- עדכן את תאריך התפוגה
        UPDATE user_subscriptions 
        SET expires_at = CASE 
            WHEN subscription_record.period = 'monthly' THEN expires_at + INTERVAL '1 month'
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

-- RLS Policies
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- מדיניות לטבלת תוכניות מנוי - כולם יכולים לקרוא
CREATE POLICY "Anyone can view subscription plans" ON subscription_plans
    FOR SELECT USING (true);

-- מדיניות לטבלת עסקאות תשלום - רק המשתמש עצמו יכול לראות את העסקאות שלו
CREATE POLICY "Users can view their own payment transactions" ON payment_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment transactions" ON payment_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment transactions" ON payment_transactions
    FOR UPDATE USING (auth.uid() = user_id);

-- מדיניות לטבלת מנויי משתמשים - רק המשתמש עצמו יכול לראות את המנויים שלו
CREATE POLICY "Users can view their own subscriptions" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions" ON user_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions" ON user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- הערות על הטבלאות
COMMENT ON TABLE subscription_plans IS 'טבלת תוכניות מנוי זמינות';
COMMENT ON TABLE payment_transactions IS 'טבלת עסקאות תשלום';
COMMENT ON TABLE user_subscriptions IS 'טבלת מנויי משתמשים פעילים';

COMMENT ON COLUMN subscription_plans.features IS 'רשימת תכונות התוכנית ב-JSON';
COMMENT ON COLUMN subscription_plans.role IS 'הרול שמקבל המשתמש עם התוכנית';
COMMENT ON COLUMN payment_transactions.status IS 'סטטוס העסקה: pending, success, failed, cancelled';
COMMENT ON COLUMN user_subscriptions.status IS 'סטטוס המנוי: active, cancelled, expired';
COMMENT ON COLUMN user_subscriptions.auto_renew IS 'האם המנוי מתחדש אוטומטית';

-- ========================================
-- בדיקות שהכל עובד
-- ========================================

-- בדוק שהטבלאות נוצרו
SELECT 'Tables created successfully' as status, 
       COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('subscription_plans', 'payment_transactions', 'user_subscriptions');

-- בדוק את תוכניות המנוי
SELECT 'Subscription plans' as info, id, name, price, role FROM subscription_plans ORDER BY price;

-- בדוק את הפונקציות
SELECT 'Functions created' as status, 
       COUNT(*) as function_count
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_user_active_subscription', 'renew_expired_subscriptions');

-- בדוק את ה-RLS policies
SELECT 'RLS Policies' as info, 
       tablename, 
       policyname, 
       cmd 
FROM pg_policies 
WHERE tablename IN ('subscription_plans', 'payment_transactions', 'user_subscriptions')
ORDER BY tablename, policyname;
