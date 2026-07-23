-- עדכון תיאור קורס הלוויתנים לתיאור המקורי
UPDATE courses 
SET 
  description = 'קורס דיגיטלי פרקטי ומעשי שכולל בתוכו קונספטים ואסטרטגיית מסחר יומי מוכחת! הקורס פונה לסוחרים מתקדמים בשוק ההון שרוצים לקחת את המסחר שלהם לרמה הבאה! וללמוד אסטרטגיית מסחר מקצועית במסחר יומי!',
  subtitle = 'הפריצה לשוק - דוד אריאל',
  instructor_name = 'דוד אריאל',
  cover_url = 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/course_media/Wheles.png',
  instructor_avatar = 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/course_media/channels4_profile.jpg',
  updated_at = NOW()
WHERE id = 'whales-course-1';

-- בדיקה שהעדכון הצליח
SELECT id, title, subtitle, description, instructor_name, cover_url, instructor_avatar
FROM courses 
WHERE id = 'whales-course-1';







