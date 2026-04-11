-- ========================================
-- הוספת מסלולי מנוי לטבלה subscription_plans
-- ========================================

-- הוספת המסלולים החדשים
INSERT INTO subscription_plans (id, name, description, price, period, features, role, popular) VALUES

-- מסלול פלוס+ (חודשי)
('plus_monthly', 'מסלול פלוס+', 'מסלול פלוס+ חודשי', 99, 'monthly',
 '["חדשות כלכליות", "הכרזות רשמיות של ברוך ודוד אריאל", "לייב שבועי ביוטיוב", "חדשות מתפרצות בזמן אמת", "דיווחי תוצאות של חברות", "קבוצה חינמית של מאות סוחרים ומשקיעים", "גישה לחדר מקהילת הפרימיום של \"השקעות וסווינגים\"", "יומן מסחר"]'::jsonb,
 'plus_user', true),

-- מסלול פרימיום (חודשי)
('premium_monthly', 'מסלול פרימיום', 'כל מה שבמסלול פלוס+ + קהילת פרימיום', 149, 'monthly',
 '["חדשות כלכליות", "הכרזות רשמיות של ברוך ודוד אריאל", "לייב שבועי ביוטיוב", "חדשות מתפרצות בזמן אמת", "דיווחי תוצאות של חברות", "קבוצה חינמית של מאות סוחרים ומשקיעים", "גישה לחדר מקהילת הפרימיום של \"השקעות וסווינגים\"", "יומן מסחר", "גישה לקהילת הפרימיום"]'::jsonb,
 'premium_user', false),

-- מסלול עלית (שנתי)
('elite_yearly', 'מסלול עלית', 'הכל פלוס קורס הלוויתנים במתנה', 1404, 'yearly',
 '["חדשות כלכליות", "הכרזות רשמיות של ברוך ודוד אריאל", "לייב שבועי ביוטיוב", "חדשות מתפרצות בזמן אמת", "דיווחי תוצאות של חברות", "קבוצה חינמית של מאות סוחרים ומשקיעים", "גישה לחדר מקהילת הפרימיום של \"השקעות וסווינגים\"", "יומן מסחר", "גישה לקהילת הפרימיום", "קורס הלוויתנים במתנה"]'::jsonb,
 'elite_user', false)

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    period = EXCLUDED.period,
    features = EXCLUDED.features,
    role = EXCLUDED.role,
    popular = EXCLUDED.popular,
    updated_at = NOW();

-- בדיקה שהמסלולים נוספו
SELECT 'Subscription plans added' as status, 
       id, name, price, period, popular 
FROM subscription_plans 
WHERE id IN ('plus_monthly', 'premium_monthly', 'elite_yearly')
ORDER BY price;

