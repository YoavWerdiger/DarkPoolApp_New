-- בדיקת RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'users';

-- בדיקת פונקציות
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('handle_new_user', 'check_email_exists', 'check_phone_exists', 'complete_user_registration');

-- בדיקת triggers
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users';

-- בדיקת מבנה הטבלה
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- בדיקת constraints
SELECT constraint_name, constraint_type, table_name
FROM information_schema.table_constraints 
WHERE table_name = 'users';

-- בדיקת משתמשים קיימים
SELECT id, display_name, email, full_name, phone, registration_completed 
FROM public.users 
LIMIT 5; 