-- סקריפט פשוט להקמת מסד נתונים לקורס הלוויתנים
-- ללא מחיקת טבלאות קיימות

-- יצירת טבלת קורסים
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  cover_url TEXT,
  instructor_name TEXT NOT NULL,
  instructor_avatar TEXT,
  duration_hours INTEGER,
  level TEXT,
  rating DECIMAL(3,2),
  students_count INTEGER DEFAULT 0,
  price DECIMAL(10,2),
  original_price DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- יצירת טבלת שיעורים
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  order_index INTEGER,
  is_completed BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- יצירת טבלת התקדמות משתמשים
CREATE TABLE IF NOT EXISTS user_course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  current_time_seconds INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id, lesson_id)
);

-- יצירת טבלת הערות משתמשים
CREATE TABLE IF NOT EXISTS user_lesson_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  notes_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id, lesson_id)
);

-- יצירת טבלת קישורי מדיה
CREATE TABLE IF NOT EXISTS lesson_media_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  vimeo_id TEXT NOT NULL,
  vimeo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id, lesson_id)
);

-- יצירת אינדקסים
CREATE INDEX IF NOT EXISTS idx_user_course_progress_user_id ON user_course_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_course_progress_course_lesson ON user_course_progress(course_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_notes_user_id ON user_lesson_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_notes_course_lesson ON user_lesson_notes(course_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_media_links_course_lesson ON lesson_media_links(course_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON lessons(course_id);

-- יצירת פונקציית עדכון updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- יצירת טריגרים
DROP TRIGGER IF EXISTS update_user_course_progress_updated_at ON user_course_progress;
CREATE TRIGGER update_user_course_progress_updated_at 
  BEFORE UPDATE ON user_course_progress 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_lesson_notes_updated_at ON user_lesson_notes;
CREATE TRIGGER update_user_lesson_notes_updated_at 
  BEFORE UPDATE ON user_lesson_notes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lesson_media_links_updated_at ON lesson_media_links;
CREATE TRIGGER update_lesson_media_links_updated_at 
  BEFORE UPDATE ON lesson_media_links 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
CREATE TRIGGER update_courses_updated_at 
  BEFORE UPDATE ON courses 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lessons_updated_at ON lessons;
CREATE TRIGGER update_lessons_updated_at 
  BEFORE UPDATE ON lessons 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- הפעלת RLS
ALTER TABLE user_course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lesson_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_media_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- מחיקת מדיניות קיימות אם הן קיימות
DROP POLICY IF EXISTS "Users can view their own progress" ON user_course_progress;
DROP POLICY IF EXISTS "Users can insert their own progress" ON user_course_progress;
DROP POLICY IF EXISTS "Users can update their own progress" ON user_course_progress;
DROP POLICY IF EXISTS "Users can view their own notes" ON user_lesson_notes;
DROP POLICY IF EXISTS "Users can insert their own notes" ON user_lesson_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON user_lesson_notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON user_lesson_notes;
DROP POLICY IF EXISTS "Anyone can view courses" ON courses;
DROP POLICY IF EXISTS "Anyone can view lessons" ON lessons;
DROP POLICY IF EXISTS "Anyone can view media links" ON lesson_media_links;

-- יצירת מדיניות RLS
CREATE POLICY "Users can view their own progress" ON user_course_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress" ON user_course_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON user_course_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own notes" ON user_lesson_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes" ON user_lesson_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" ON user_lesson_notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" ON user_lesson_notes
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view courses" ON courses
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view lessons" ON lessons
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view media links" ON lesson_media_links
  FOR SELECT USING (is_active = true);

-- הוספת נתוני דמה
INSERT INTO courses (id, title, subtitle, description, cover_url, instructor_name, instructor_avatar, duration_hours, level, rating, students_count, price, original_price, is_active) VALUES
('whales-course-1', 'קורס הלוויתנים', 'הפריצה לשוק - דוד אריאל', 'קהילת הסוחרים של ישראל - קורס מקיף למסחר מתקדם עם מודל PO3 ואסטרטגיות מתקדמות.', 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/course_media/Wheles.png', 'דוד אריאל', 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/course_media/channels4_profile.jpg', 8, 'מתקדם', 4.8, 1250, 0, 0, true)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  cover_url = EXCLUDED.cover_url,
  instructor_name = EXCLUDED.instructor_name,
  instructor_avatar = EXCLUDED.instructor_avatar,
  duration_hours = EXCLUDED.duration_hours,
  level = EXCLUDED.level,
  rating = EXCLUDED.rating,
  students_count = EXCLUDED.students_count,
  price = EXCLUDED.price,
  original_price = EXCLUDED.original_price,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- הוספת שיעורים
INSERT INTO lessons (id, course_id, title, description, duration_minutes, order_index, is_completed, is_active) VALUES
('lesson-1', 'whales-course-1', 'הכירות עם הקורס', 'הכרות עם הקורס והנושאים שילמדו בו', 45, 1, false, true),
('lesson-2', 'whales-course-1', 'מה זה - Price Action', 'הבנת מושגי ה-Price Action והשימוש בהם', 60, 2, false, true),
('lesson-3', 'whales-course-1', 'מה זה - Liquidity', 'הבנת מושג הנזילות והשפעתו על השוק', 40, 3, false, true),
('lesson-4', 'whales-course-1', 'מה זה - FVG', 'הבנת Fair Value Gaps וזיהוי הזדמנויות', 35, 4, false, true),
('lesson-5', 'whales-course-1', 'מה זה - IFVG', 'הבנת Imbalanced Fair Value Gaps', 30, 5, false, true),
('lesson-6', 'whales-course-1', 'אסטרטגיית - מודל PO3', 'לימוד מודל PO3 ואסטרטגיות מסחר', 50, 6, false, true),
('lesson-7', 'whales-course-1', 'אסטרטגיית - Golden Zone + FVG', 'שילוב Golden Zone עם Fair Value Gaps', 55, 7, false, true),
('lesson-8', 'whales-course-1', 'סמינר PO3 (חזרה על מושגים והבנת המודל לעומק)', 'סמינר מקיף לחזרה על מושגי PO3 והבנה מעמיקה', 90, 8, false, true),
('lesson-9', 'whales-course-1', 'הלוויתנים מקנאים בכם!', 'הבנת התנהגות הלוויתנים והשפעתם על השוק', 25, 9, false, true)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  duration_minutes = EXCLUDED.duration_minutes,
  order_index = EXCLUDED.order_index,
  is_completed = EXCLUDED.is_completed,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- הוספת קישורי מדיה
INSERT INTO lesson_media_links (course_id, lesson_id, vimeo_id, vimeo_url, thumbnail_url, title, description, duration_minutes, is_active) VALUES
('whales-course-1', 'lesson-1', '1095579213', 'https://vimeo.com/1095579213?share=copy', 'https://via.placeholder.com/300x200/4F46E5/FFFFFF?text=Video+Preview', 'הכירות עם הקורס', 'הכרות עם הקורס והנושאים שילמדו בו', 45, true),
('whales-course-1', 'lesson-2', '1095573038', 'https://vimeo.com/1095573038?share=copy', 'https://via.placeholder.com/300x200/10B981/FFFFFF?text=Price+Action', 'מה זה - Price Action', 'הבנת מושגי ה-Price Action והשימוש בהם', 60, true),
('whales-course-1', 'lesson-3', '1095570862', 'https://vimeo.com/1095570862?share=copy', 'https://via.placeholder.com/300x200/F59E0B/FFFFFF?text=Liquidity', 'מה זה - Liquidity', 'הבנת מושג הנזילות והשפעתו על השוק', 40, true),
('whales-course-1', 'lesson-4', '1095761556', 'https://vimeo.com/1095761556?share=copy', 'https://via.placeholder.com/300x200/EF4444/FFFFFF?text=FVG', 'מה זה - FVG', 'הבנת Fair Value Gaps וזיהוי הזדמנויות', 35, true),
('whales-course-1', 'lesson-5', '1095760652', 'https://vimeo.com/1095760652?share=copy', 'https://via.placeholder.com/300x200/8B5CF6/FFFFFF?text=IFVG', 'מה זה - IFVG', 'הבנת Imbalanced Fair Value Gaps', 30, true),
('whales-course-1', 'lesson-6', '1095776680', 'https://vimeo.com/1095776680?share=copy', 'https://via.placeholder.com/300x200/06B6D4/FFFFFF?text=PO3', 'אסטרטגיית - מודל PO3', 'לימוד מודל PO3 ואסטרטגיות מסחר', 50, true),
('whales-course-1', 'lesson-7', '1099364716', 'https://vimeo.com/1099364716?share=copy', 'https://via.placeholder.com/300x200/F97316/FFFFFF?text=Golden+Zone', 'אסטרטגיית - Golden Zone + FVG', 'שילוב Golden Zone עם Fair Value Gaps', 55, true),
('whales-course-1', 'lesson-8', '1108814085', 'https://vimeo.com/1108814085?share=copy', 'https://via.placeholder.com/300x200/84CC16/FFFFFF?text=סמינר+PO3', 'סמינר PO3 (חזרה על מושגים והבנת המודל לעומק)', 'סמינר מקיף לחזרה על מושגי PO3 והבנה מעמיקה', 90, true),
('whales-course-1', 'lesson-9', '1095763209', 'https://vimeo.com/1095763209?share=copy', 'https://via.placeholder.com/300x200/EC4899/FFFFFF?text=הלוויתנים', 'הלוויתנים מקנאים בכם!', 'הבנת התנהגות הלוויתנים והשפעתם על השוק', 25, true)
ON CONFLICT (course_id, lesson_id) DO UPDATE SET
  vimeo_id = EXCLUDED.vimeo_id,
  vimeo_url = EXCLUDED.vimeo_url,
  thumbnail_url = EXCLUDED.thumbnail_url,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  duration_minutes = EXCLUDED.duration_minutes,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- הודעת הצלחה
SELECT 'מסד הנתונים לקורס הלוויתנים הוקם בהצלחה!' as message;
