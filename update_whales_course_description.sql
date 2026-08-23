-- עדכון טקסט קורס הלווייתנים
UPDATE courses 
SET 
  title = 'הלווייתנים',
  subtitle = 'מסחר יומי לפי זרימות מוסדיות ונזילות',
  description = E'למי הקורס מתאים?\nלסוחרים שרוצים להעמיק במסחר יומי ולהבין כיצד לזהות זרימות גדולות ונזילות בשוק.\n\nמה תלמדו בקורס?\nבקורס תלמדו כלים לניתוח מבנה שוק ונזילות — כולל מושגים מעולם ה־Smart Money Concepts (Order Blocks, FVG, Premium & Discount ועוד) — ואיך ליישם אותם במסחר יומי במניות ובאופציות.\n\nבנוסף תלמדו כיצד לבנות תוכנית עבודה יומית, לנהל עסקאות בזמן אמת ולשלב בין ניתוח זרימות לבין ניהול סיכונים מסודר.',
  instructor_name = 'דוד אריאל',
  cover_url = 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/course_media/whales-course-banner.jpg',
  instructor_avatar = 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/course_media/channels4_profile.jpg',
  updated_at = NOW()
WHERE id = 'whales-course-1';

SELECT id, title, subtitle, description, instructor_name, cover_url, instructor_avatar
FROM courses 
WHERE id = 'whales-course-1';
