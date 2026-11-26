-- יצירת / עדכון קורס האורקל (מסחר סווינג באופציות)
INSERT INTO courses (
  id,
  title,
  subtitle,
  description,
  cover_url,
  instructor_name,
  instructor_avatar,
  price,
  original_price,
  is_active,
  access
) VALUES (
  'oracle-course',
  'האורקל',
  'קורס הדגל של DarkPool למסחר סווינג באופציות',
  E'למי הקורס מתאים?\nלסוחרים שכבר מכירים את יסודות שוק ההון ורוצים ללמוד כיצד לסחור באופציות בצורה מקצועית, מדויקת ושיטתית.\n\nמה תלמדו בקורס?\nבקורס תלמדו כיצד לאתר עסקאות סווינג איכותיות באופציות, לבצע ניתוח טכני מתקדם, לזהות אזורי כניסה ויציאה בעלי הסתברות גבוהה, להבין כיצד האופציות מתנהגות בפועל, לנהל סיכונים בצורה נכונה ולבנות אסטרטגיית מסחר עקבית לטווח הארוך.\n\nהמטרה היא להעניק לכם שיטה ברורה ומסודרת שתאפשר לכם לקבל החלטות מבוססות נתונים, במקום לפעול מתוך רגש או ניחוש.',
  'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/course_media/oracle-course-banner.jpg',
  'דוד אריאל',
  'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/course_media/channels4_profile.jpg',
  299,
  599,
  true,
  'free'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  cover_url = EXCLUDED.cover_url,
  instructor_name = EXCLUDED.instructor_name,
  instructor_avatar = EXCLUDED.instructor_avatar,
  price = EXCLUDED.price,
  original_price = EXCLUDED.original_price,
  is_active = EXCLUDED.is_active,
  access = EXCLUDED.access,
  updated_at = NOW();

SELECT id, title, subtitle, cover_url, price, original_price, access, is_active
FROM courses
WHERE id = 'oracle-course';
