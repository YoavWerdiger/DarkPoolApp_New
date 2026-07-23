-- עדכון כל ה-duration_minutes ב-lesson_media_links עבור קורס ההכשרה של דוד אריאל
-- מעדכן את lesson_media_links.duration_minutes לפי lessons.duration_minutes

UPDATE lesson_media_links lml
SET duration_minutes = l.duration_minutes,
    updated_at = NOW()
FROM lessons l
WHERE lml.course_id = l.course_id
  AND lml.lesson_id = l.id
  AND lml.course_id = 'david-training-course'
  AND l.duration_minutes IS NOT NULL
  AND l.duration_minutes > 0;

-- הצגת התוצאות - בדיקה מה עודכן
SELECT 
  lml.course_id,
  lml.lesson_id,
  lml.title,
  lml.youtube_id,
  lml.duration_minutes as media_duration_minutes,
  l.duration_minutes as lesson_duration_minutes,
  CASE 
    WHEN lml.duration_minutes = l.duration_minutes THEN '✅ תואם'
    WHEN lml.duration_minutes IS NULL OR lml.duration_minutes = 0 THEN '⚠️ חסר ב-media'
    WHEN l.duration_minutes IS NULL OR l.duration_minutes = 0 THEN '⚠️ חסר ב-lessons'
    ELSE '❌ לא תואם'
  END as status
FROM lesson_media_links lml
LEFT JOIN lessons l 
  ON lml.course_id = l.course_id 
  AND lml.lesson_id = l.id
WHERE lml.course_id = 'david-training-course'
ORDER BY lml.lesson_id;



