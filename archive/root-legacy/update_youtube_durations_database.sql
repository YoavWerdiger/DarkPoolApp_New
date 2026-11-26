-- עדכון duration_minutes ב-lesson_media_links עבור קורס ההכשרה של דוד אריאל
-- הסקריפט מעדכן את lesson_media_links.duration_minutes לפי:
-- 1. הערך ב-lessons.duration_minutes (אם קיים)
-- 2. הערך המקסימלי מ-user_course_progress.total_duration_seconds (אם אין ב-lessons)

-- עדכון מ-lessons (עדיפות ראשונה)
-- מעדכן את duration_minutes ב-lesson_media_links לפי duration_minutes ב-lessons
UPDATE lesson_media_links lml
SET duration_minutes = l.duration_minutes,
    updated_at = NOW()
FROM lessons l
WHERE lml.course_id = l.course_id
  AND lml.lesson_id = l.id
  AND lml.course_id = 'david-training-course'
  AND l.duration_minutes IS NOT NULL
  AND l.duration_minutes > 0;

-- עדכון מ-user_course_progress (אם אין ב-lessons או אם הערך ב-lessons הוא 0)
UPDATE lesson_media_links lml
SET duration_minutes = ROUND(ucp.max_duration_seconds / 60.0),
    updated_at = NOW()
FROM (
  SELECT 
    course_id,
    lesson_id,
    MAX(total_duration_seconds) as max_duration_seconds
  FROM user_course_progress
  WHERE course_id = 'david-training-course'
    AND total_duration_seconds > 0
  GROUP BY course_id, lesson_id
) ucp
WHERE lml.course_id = ucp.course_id
  AND lml.lesson_id = ucp.lesson_id
  AND lml.course_id = 'david-training-course'
  AND (lml.duration_minutes IS NULL OR lml.duration_minutes = 0)
  AND NOT EXISTS (
    SELECT 1 FROM lessons l 
    WHERE l.course_id = lml.course_id 
      AND l.id = lml.lesson_id 
      AND l.duration_minutes IS NOT NULL 
      AND l.duration_minutes > 0
  );

-- הצגת התוצאות - בדיקה מה עודכן
SELECT 
  lml.course_id,
  lml.lesson_id,
  lml.title,
  lml.youtube_id,
  lml.duration_minutes as media_duration_minutes,
  l.duration_minutes as lesson_duration_minutes,
  ROUND(MAX(ucp.total_duration_seconds) / 60.0) as progress_duration_minutes,
  CASE 
    WHEN lml.duration_minutes IS NOT NULL AND lml.duration_minutes > 0 THEN '✅ עודכן'
    WHEN l.duration_minutes IS NOT NULL AND l.duration_minutes > 0 THEN '⚠️ יש ב-lessons אבל לא עודכן'
    WHEN MAX(ucp.total_duration_seconds) > 0 THEN '⚠️ יש ב-progress אבל לא עודכן'
    ELSE '❌ חסר'
  END as status
FROM lesson_media_links lml
LEFT JOIN lessons l 
  ON lml.course_id = l.course_id 
  AND lml.lesson_id = l.id
LEFT JOIN user_course_progress ucp 
  ON lml.course_id = ucp.course_id 
  AND lml.lesson_id = ucp.lesson_id
  AND ucp.total_duration_seconds > 0
WHERE lml.course_id = 'david-training-course'
GROUP BY lml.course_id, lml.lesson_id, lml.title, lml.youtube_id, lml.duration_minutes, l.duration_minutes
ORDER BY lml.lesson_id;

