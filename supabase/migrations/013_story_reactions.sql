-- ============================================
-- ריאקציות לסטורי (כמו באינסטגרם)
-- ============================================
-- כל משתמש יכול לשלוח ריאקציה אחת (אימוג'י) לכל סטורי,
-- ולעדכן אותה (לשנות את האימוג'י). ניתן גם למחוק.
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_story_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.user_stories(id) ON DELETE CASCADE,
  reactor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(story_id, reactor_id)
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_user_story_reactions_story_id
  ON public.user_story_reactions(story_id);
CREATE INDEX IF NOT EXISTS idx_user_story_reactions_reactor_id
  ON public.user_story_reactions(reactor_id);

-- טריגר לעדכון updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_story_reactions_updated_at ON public.user_story_reactions;
CREATE TRIGGER trg_user_story_reactions_updated_at
BEFORE UPDATE ON public.user_story_reactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.user_story_reactions ENABLE ROW LEVEL SECURITY;

-- בעל הסטורי רואה מי הגיב + המשתמש עצמו רואה את הריאקציה שלו
CREATE POLICY "user_story_reactions_select" ON public.user_story_reactions
  FOR SELECT USING (
    auth.uid() = reactor_id
    OR EXISTS (
      SELECT 1 FROM public.user_stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

-- כל משתמש מחובר יכול להגיב לסטורי (בתנאי שהוא לא בעל הסטורי)
CREATE POLICY "user_story_reactions_insert" ON public.user_story_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = reactor_id
    AND NOT EXISTS (
      SELECT 1 FROM public.user_stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

-- עדכון (החלפת אימוג'י) – רק המגיב עצמו
CREATE POLICY "user_story_reactions_update" ON public.user_story_reactions
  FOR UPDATE USING (auth.uid() = reactor_id)
  WITH CHECK (auth.uid() = reactor_id);

-- מחיקה – רק המגיב עצמו
CREATE POLICY "user_story_reactions_delete" ON public.user_story_reactions
  FOR DELETE USING (auth.uid() = reactor_id);
