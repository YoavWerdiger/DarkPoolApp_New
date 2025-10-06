-- ========================================
-- פקודות להפעלת מערכת התשלום
-- ========================================

-- שלב 1: הפעל את סכמת מסד הנתונים
\i payment_database_schema.sql

-- שלב 2: בדוק שהטבלאות נוצרו
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('subscription_plans', 'payment_transactions', 'user_subscriptions');

-- שלב 3: בדוק את תוכניות המנוי
SELECT * FROM subscription_plans ORDER BY price;

-- שלב 4: בדוק את הפונקציות
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_user_active_subscription', 'renew_expired_subscriptions');

-- שלב 5: בדוק את ה-RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('subscription_plans', 'payment_transactions', 'user_subscriptions');

-- שלב 6: בדוק את האינדקסים
SELECT indexname, tablename, indexdef 
FROM pg_indexes 
WHERE tablename IN ('subscription_plans', 'payment_transactions', 'user_subscriptions');

-- ========================================
-- פקודות בדיקה נוספות
-- ========================================

-- בדוק משתמש לדוגמה (החלף את ה-UUID)
-- SELECT * FROM get_user_active_subscription('YOUR_USER_UUID_HERE');

-- בדוק עסקאות תשלום
-- SELECT * FROM payment_transactions ORDER BY created_at DESC LIMIT 10;

-- בדוק מנויי משתמשים
-- SELECT * FROM user_subscriptions ORDER BY created_at DESC LIMIT 10;

-- ========================================
-- פקודות ניקוי (רק אם צריך להתחיל מחדש)
-- ========================================

-- DROP TABLE IF EXISTS user_subscriptions CASCADE;
-- DROP TABLE IF EXISTS payment_transactions CASCADE;
-- DROP TABLE IF EXISTS subscription_plans CASCADE;
-- DROP FUNCTION IF EXISTS get_user_active_subscription(UUID);
-- DROP FUNCTION IF EXISTS renew_expired_subscriptions();
-- DROP FUNCTION IF EXISTS update_updated_at_column();

-- ========================================
-- הוראות הפעלה
-- ========================================

/*
1. פתח את Supabase Dashboard
2. עבור ל-SQL Editor
3. העתק והדבק את הפקודות למעלה
4. הפעל אותן בסדר
5. ודא שהכל עובד עם פקודות הבדיקה

לאחר מכן:
1. העלה את ה-Edge Functions:
   supabase functions deploy payment-callback
   supabase functions deploy payment-success

2. עדכן את ה-URLs ב-paymentService.ts עם פרטי הפרויקט שלך

3. הפעל את האפליקציה ובדוק את מערכת התשלום
*/
