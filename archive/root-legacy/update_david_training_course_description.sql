-- עדכון תיאור קורס הכשרה של דוד אריאל
UPDATE courses 
SET 
  description = 'ההכשרה הינו קורס מסחר מלא בשוק ההון של דוד אריאל מערוץ היוטיוב של ״הפריצה לשוק ההון״, לימוד פורה ומעשיר!',
  updated_at = NOW()
WHERE id = 'david-training-course';

-- עדכון באנר הקורס (cover_url)
-- הערה: יש להעלות את תמונת הבאנר החדשה ל-Supabase Storage תחילה
-- לאחר העלאה, עדכן את ה-URL למטה והרץ את ה-UPDATE הזה
-- UPDATE courses 
-- SET 
--   cover_url = 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/course_media/[שם_הקובץ_החדש].png',
--   updated_at = NOW()
-- WHERE id = 'david-training-course';

-- בדיקה שהעדכון הצליח
SELECT id, title, subtitle, description, instructor_name, cover_url, instructor_avatar
FROM courses 
WHERE id = 'david-training-course';

