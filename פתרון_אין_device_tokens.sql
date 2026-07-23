-- 🔧 פתרון: אין Device Tokens במערכת
-- ====================================
-- הבעיה: 14 משתמשים, אבל 0 device tokens
-- זה אומר שהאפליקציה לא רושמת device tokens

-- 1. בדוק את ה-RLS Policies על device_tokens
SELECT 
  'RLS Policies Check' as check_name,
  policyname,
  cmd as command,
  roles,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as has_using,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END as has_with_check
FROM pg_policies
WHERE tablename = 'device_tokens'
ORDER BY cmd, policyname;

-- 2. בדוק אם יש policy לכניסה (INSERT)
-- צריך להיות policy שנותן למשתמשים להוסיף device tokens שלהם
SELECT 
  'INSERT Policy Check' as check_name,
  COUNT(*) as insert_policies_count
FROM pg_policies
WHERE tablename = 'device_tokens'
  AND cmd = 'INSERT';

-- 3. נסה לראות את ה-Policies המלאים
SELECT 
  'Full Policy Details' as check_name,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'device_tokens';

-- 4. בדוק אם הטבלה קיימת עם המבנה הנכון
SELECT 
  'Table Structure Check' as check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'device_tokens'
ORDER BY ordinal_position;

-- 5. בדוק אם יש constraints על הטבלה
SELECT 
  'Constraints Check' as check_name,
  constraint_name,
  constraint_type,
  table_name
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'device_tokens';

-- 6. בדוק את ה-Foreign Key constraint
SELECT 
  'Foreign Key Check' as check_name,
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'device_tokens';

-- 7. בדוק אם יש unique constraint
SELECT 
  'Unique Constraint Check' as check_name,
  tc.constraint_name,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_name = 'device_tokens';



