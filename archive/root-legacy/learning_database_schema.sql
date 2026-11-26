-- סכמת מסד נתונים לקורס הלוויתנים
-- טבלת התקדמות משתמשים בקורסים
CREATE TABLE user_course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
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

-- טבלת הערות משתמשים לשיעורים
CREATE TABLE user_lesson_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  notes_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id, lesson_id)
);

-- טבלת קישורי מדיה לשיעורים
CREATE TABLE lesson_media_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
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

-- טבלת קורסים
CREATE TABLE courses (
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

-- טבלת שיעורים
CREATE TABLE lessons (
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

-- אינדקסים לביצועים
CREATE INDEX idx_user_course_progress_user_id ON user_course_progress(user_id);
CREATE INDEX idx_user_course_progress_course_lesson ON user_course_progress(course_id, lesson_id);
CREATE INDEX idx_user_lesson_notes_user_id ON user_lesson_notes(user_id);
CREATE INDEX idx_user_lesson_notes_course_lesson ON user_lesson_notes(course_id, lesson_id);
CREATE INDEX idx_lesson_media_links_course_lesson ON lesson_media_links(course_id, lesson_id);
CREATE INDEX idx_lessons_course_id ON lessons(course_id);

-- פונקציות עזר
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- טריגרים לעדכון updated_at
CREATE TRIGGER update_user_course_progress_updated_at 
  BEFORE UPDATE ON user_course_progress 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_lesson_notes_updated_at 
  BEFORE UPDATE ON user_lesson_notes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lesson_media_links_updated_at 
  BEFORE UPDATE ON lesson_media_links 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at 
  BEFORE UPDATE ON courses 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at 
  BEFORE UPDATE ON lessons 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE user_course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lesson_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_media_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- מדיניות RLS למשתמשים
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

-- מדיניות RLS לקורסים ושיעורים (כולם יכולים לראות)
CREATE POLICY "Anyone can view courses" ON courses
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view lessons" ON lessons
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view media links" ON lesson_media_links
  FOR SELECT USING (is_active = true);
