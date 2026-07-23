-- ============================================
-- Personal Message Deletions
-- ============================================
-- טבלה למעקב אחר הודעות שנמחקו אישית על ידי משתמשים
-- ============================================

-- טבלה למחיקה אישית
CREATE TABLE IF NOT EXISTS public.chat_message_personal_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(message_id, user_id)
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_chat_message_personal_deletions_user_id ON public.chat_message_personal_deletions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_personal_deletions_message_id ON public.chat_message_personal_deletions(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_personal_deletions_group_id ON public.chat_message_personal_deletions(group_id);

-- RLS Policies
ALTER TABLE public.chat_message_personal_deletions ENABLE ROW LEVEL SECURITY;

-- מחיקת פוליסות קיימות (אם קיימות)
DROP POLICY IF EXISTS "Users can view their own personal deletions" ON public.chat_message_personal_deletions;
DROP POLICY IF EXISTS "Users can insert their own personal deletions" ON public.chat_message_personal_deletions;
DROP POLICY IF EXISTS "Users can delete their own personal deletions" ON public.chat_message_personal_deletions;

-- משתמש יכול לראות רק את המחיקות שלו
CREATE POLICY "Users can view their own personal deletions" ON public.chat_message_personal_deletions
  FOR SELECT USING (user_id = auth.uid());

-- משתמש יכול להוסיף מחיקה אישית
CREATE POLICY "Users can insert their own personal deletions" ON public.chat_message_personal_deletions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- משתמש יכול למחוק את המחיקה האישית שלו (להציג שוב את ההודעה)
CREATE POLICY "Users can delete their own personal deletions" ON public.chat_message_personal_deletions
  FOR DELETE USING (user_id = auth.uid());

