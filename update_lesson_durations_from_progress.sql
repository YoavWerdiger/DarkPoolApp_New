-- עדכון duration_minutes ב-lesson_media_links מה-total_duration_seconds ב-user_course_progress
-- הסקריפט לוקח את הערך המקסימלי של total_duration_seconds לכל שיעור (אם יש כמה משתמשים שצפו)
-- ומעדכן את lesson_media_links.duration_minutes בהתאם

-- עדכון כללי - מעדכן את כל השיעורים שיש להם progress בכל הקורסים
-- זה יעבוד גם אם יש course_id אחר ב-user_course_progress
UPDATE lesson_media_links lml
SET duration_minutes = ROUND(ucp.max_duration_seconds / 60.0)
FROM (
  SELECT 
    course_id,
    lesson_id,
    MAX(total_duration_seconds) as max_duration_seconds
  FROM user_course_progress
  WHERE total_duration_seconds > 0
  GROUP BY course_id, lesson_id
) ucp
WHERE lml.course_id = ucp.course_id
  AND lml.lesson_id = ucp.lesson_id;

-- בדיקה: איזה course_id יש ב-user_course_progress
SELECT DISTINCT course_id, COUNT(*) as progress_count
FROM user_course_progress
WHERE total_duration_seconds > 0
GROUP BY course_id
ORDER BY course_id;

-- הצגת התוצאות - בדיקה מה עודכן
SELECT 
  lml.course_id,
  lml.lesson_id,
  lml.title,
  lml.duration_minutes as updated_duration_minutes,
  ROUND(MAX(ucp.total_duration_seconds) / 60.0) as duration_from_progress_minutes,
  MAX(ucp.total_duration_seconds) as max_duration_seconds,
  COUNT(DISTINCT ucp.user_id) as users_watched
FROM lesson_media_links lml
LEFT JOIN user_course_progress ucp 
  ON lml.course_id = ucp.course_id 
  AND lml.lesson_id = ucp.lesson_id
  AND ucp.total_duration_seconds > 0
WHERE lml.course_id IN ('david-training-course', 'whales-course-1')
GROUP BY lml.course_id, lml.lesson_id, lml.title, lml.duration_minutes
ORDER BY lml.course_id, lml.lesson_id;

