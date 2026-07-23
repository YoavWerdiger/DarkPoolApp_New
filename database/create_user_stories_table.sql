-- ============================================
-- טבלת Stories (סטטוסים) – כמו WhatsApp Status
-- ============================================
-- כל משתמש יכול להעלות סטטוס (תמונה/טקסט) שנמחק אחרי 24 שעות
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- תוכן
  media_type TEXT NOT NULL DEFAULT 'image', -- 'image', 'video', 'text'
  media_url TEXT,        -- לתמונה/וידאו – קישור ל-Supabase Storage
  content TEXT,          -- לטקסט בלבד או כותרת
  
  -- תצוגה
  background_color TEXT,  -- לסטטוס טקסט – צבע רקע (hex)
  
  -- זמנים
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  
  CONSTRAINT valid_media_type CHECK (media_type IN ('image', 'video', 'text'))
);

-- טבלת צפיות – מי צפה באיזה סטטוס
CREATE TABLE IF NOT EXISTS public.user_story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.user_stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(story_id, viewer_id)
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_user_stories_user_id ON public.user_stories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stories_expires_at ON public.user_stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_stories_created_at ON public.user_stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_story_views_story_id ON public.user_story_views(story_id);

-- RLS
ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_story_views ENABLE ROW LEVEL SECURITY;

-- כל אחד יכול לראות סטטוסים (חברי קהילה)
CREATE POLICY "user_stories_select" ON public.user_stories
  FOR SELECT USING (true);

-- רק הבעלים יכול להעלות/למחוק
CREATE POLICY "user_stories_insert" ON public.user_stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_stories_delete" ON public.user_stories
  FOR DELETE USING (auth.uid() = user_id);

-- צפיות – רק הבעלים רואה מי צפה
CREATE POLICY "user_story_views_select" ON public.user_story_views
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

CREATE POLICY "user_story_views_insert" ON public.user_story_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);
