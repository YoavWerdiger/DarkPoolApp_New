-- ============================================
-- תיקון RLS Policies לפרוגרס למידה
-- ============================================
-- קובץ זה מוודא שהפרוגרס של כל משתמש מוצג רק למשתמש עצמו
-- ============================================

-- 1. מחיקת כל ה-policies הקיימים (אם יש)
DROP POLICY IF EXISTS "Users can view their own progress" ON user_course_progress;
DROP POLICY IF EXISTS "Users can insert their own progress" ON user_course_progress;
DROP POLICY IF EXISTS "Users can update their own progress" ON user_course_progress;
DROP POLICY IF EXISTS "Users can delete their own progress" ON user_course_progress;

-- 2. וידוא ש-RLS מופעל
ALTER TABLE user_course_progress ENABLE ROW LEVEL SECURITY;

-- 3. יצירת policies חדשים ומדויקים
-- SELECT - רק המשתמש יכול לראות את הפרוגרס שלו
CREATE POLICY "Users can view their own progress" ON user_course_progress
  FOR SELECT 
  USING (auth.uid() = user_id);

-- INSERT - רק המשתמש יכול ליצור פרוגרס לעצמו
CREATE POLICY "Users can insert their own progress" ON user_course_progress
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- UPDATE - רק המשתמש יכול לעדכן את הפרוגרס שלו
CREATE POLICY "Users can update their own progress" ON user_course_progress
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE - רק המשתמש יכול למחוק את הפרוגרס שלו
CREATE POLICY "Users can delete their own progress" ON user_course_progress
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================
-- תיקון RLS Policies להערות משתמש
-- ============================================

-- מחיקת policies קיימים
DROP POLICY IF EXISTS "Users can view their own notes" ON user_lesson_notes;
DROP POLICY IF EXISTS "Users can insert their own notes" ON user_lesson_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON user_lesson_notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON user_lesson_notes;

-- וידוא ש-RLS מופעל
ALTER TABLE user_lesson_notes ENABLE ROW LEVEL SECURITY;

-- יצירת policies חדשים
CREATE POLICY "Users can view their own notes" ON user_lesson_notes
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes" ON user_lesson_notes
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" ON user_lesson_notes
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" ON user_lesson_notes
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================
-- בדיקה שהפוליסיות עובדות
-- ============================================
-- הרץ את השאילתה הזו כדי לבדוק שהפוליסיות מוגדרות נכון:
-- SELECT 
--   schemaname, 
--   tablename, 
--   policyname, 
--   permissive, 
--   roles, 
--   cmd, 
--   qual 
-- FROM pg_policies 
-- WHERE tablename IN ('user_course_progress', 'user_lesson_notes')
-- ORDER BY tablename, policyname;

-- ============================================
-- הערות חשובות:
-- ============================================
-- 1. הפוליסיות משתמשות ב-auth.uid() כדי לוודא שהמשתמש רואה רק את הנתונים שלו
-- 2. אם יש בעיות, בדוק שהטבלה user_course_progress קיימת ושדה user_id הוא UUID
-- 3. אם עדיין יש בעיות, בדוק שהמשתמש מחובר (auth.uid() לא null)
-- ============================================




