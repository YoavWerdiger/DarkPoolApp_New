-- ========================================
-- עדכון מסלולי מנוי לפי דף הנחיתה darkpool.site
-- ========================================

-- מסלולים ישנים נשמרים כרשומות היסטוריות (payment_transactions מצביע עליהם)
-- לא מוחקים — רק מוסיפים/מעדכנים את המסלולים החדשים

-- עדכון / הכנסת המסלולים החדשים
INSERT INTO subscription_plans (id, name, description, price, period, features, role, popular) VALUES

-- מסלול חינמי
('free', 'חינמי', 'גישה חינמית לתכנים הציבוריים', 0, 'monthly',
 '["חדשות כלכליות", "לייב מסחר יומי ביוטיוב", "תמיכה בערוץ היוטיוב", "קבוצת השקעות בבורסה הישראלית"]'::jsonb,
 'free_user', false),

-- מסלול חודשי - ₪249 ללא התחייבות
('monthly', 'חודשי', 'ללא התחייבות', 249, 'monthly',
 '["מענה על שאלות", "יחס אישי וליווי קהילתי", "חדשות מתפרצות בזמן אמת", "חדשות כלכליות", "לייב מסחר יומי ביוטיוב", "רשימת מעקב למסחר יומי עם יעדים ברורים", "ניתוחים וסטאפים לסווינגים", "שיתוף תיק השקעות של הצוות", "תמיכה בערוץ היוטיוב", "קבוצת השקעות בבורסה הישראלית", "קורס הלוויתנים"]'::jsonb,
 'premium_user', false),

-- מסלול רבעוני - ₪399 ל-3 חודשים (חסוך 47%)
('quarterly', 'רבעוני', 'חסוך 47% ברבעון', 399, 'quarterly',
 '["מענה על שאלות", "יחס אישי וליווי קהילתי", "חדשות מתפרצות בזמן אמת", "חדשות כלכליות", "לייב מסחר יומי ביוטיוב", "רשימת מעקב למסחר יומי עם יעדים ברורים", "ניתוחים וסטאפים לסווינגים", "שיתוף תיק השקעות של הצוות", "תמיכה בערוץ היוטיוב", "קבוצת השקעות בבורסה הישראלית", "קורס הלוויתנים"]'::jsonb,
 'premium_user', true),

-- מסלול שנתי - ₪117/חודש = ₪1,404/שנה (חסוך 53%)
('yearly', 'חודשי - שנתי', 'חסוך 53% בשנה', 1404, 'yearly',
 '["מענה על שאלות", "יחס אישי וליווי קהילתי", "חדשות מתפרצות בזמן אמת", "חדשות כלכליות", "לייב מסחר יומי ביוטיוב", "רשימת מעקב למסחר יומי עם יעדים ברורים", "ניתוחים וסטאפים לסווינגים", "שיתוף תיק השקעות של הצוות", "תמיכה בערוץ היוטיוב", "קבוצת השקעות בבורסה הישראלית", "קורס הלוויתנים"]'::jsonb,
 'premium_user', false)

ON CONFLICT (id) DO UPDATE SET
    name        = EXCLUDED.name,
    description = EXCLUDED.description,
    price       = EXCLUDED.price,
    period      = EXCLUDED.period,
    features    = EXCLUDED.features,
    role        = EXCLUDED.role,
    popular     = EXCLUDED.popular,
    updated_at  = NOW();

-- עדכון role לפי תקופת החידוש (תמיכה לאחור למשתמשים קיימים)
UPDATE users
SET subscription_role = 'premium_user'
WHERE subscription_plan IN ('plus_monthly', 'premium_monthly', 'elite_yearly', 'monthly', 'quarterly', 'yearly')
  AND subscription_role NOT IN ('premium_user', 'vip_user', 'admin');

-- וידוא
SELECT 'Plans updated to match darkpool.site' AS status,
       id, name, price, period, popular
FROM subscription_plans
WHERE id IN ('free', 'monthly', 'quarterly', 'yearly')
ORDER BY price;
