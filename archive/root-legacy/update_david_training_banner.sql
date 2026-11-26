-- עדכון באנר קורס הכשרה של דוד אריאל
-- הוראות:
-- 1. העלה את תמונת הבאנר החדשה ל-Supabase Storage:
--    - עבור ל-Supabase Dashboard > Storage > course_media
--    - לחץ על "Upload" והעלה את תמונת הבאנר
-- 2. העתק את ה-URL של הקובץ שהעלית
-- 3. עדכן את ה-URL למטה והרץ את ה-UPDATE הזה

UPDATE courses 
SET 
  cover_url = 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/course_media/[שם_הקובץ_החדש].png',
  -- לדוגמה: cover_url = 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/course_media/david_training_banner.png',
  updated_at = NOW()
WHERE id = 'david-training-course';

-- בדיקה שהעדכון הצליח
SELECT id, title, subtitle, description, instructor_name, cover_url, instructor_avatar
FROM courses 
WHERE id = 'david-training-course';







