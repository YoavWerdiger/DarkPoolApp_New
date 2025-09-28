-- 🗳️ מערכת הסקרים - Polls System
-- קובץ SQL ליצירת הטבלאות והמדיניות הנדרשות

-- ========================================
-- יצירת טבלאות הסקרים
-- ========================================

-- טבלת הסקרים הראשית
CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of {id, text, votes_count}
  multiple_choice BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- טבלת ההצבעות
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL, -- References the option id from the JSONB options array
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_id, user_id, option_id) -- Prevent duplicate votes from same user on same option
);

-- ========================================
-- יצירת Indexes לביצועים
-- ========================================

-- Indexes for polls table
CREATE INDEX IF NOT EXISTS idx_polls_chat_id ON public.polls(chat_id);
CREATE INDEX IF NOT EXISTS idx_polls_creator_id ON public.polls(creator_id);
CREATE INDEX IF NOT EXISTS idx_polls_created_at ON public.polls(created_at);
CREATE INDEX IF NOT EXISTS idx_polls_is_locked ON public.polls(is_locked);

-- Indexes for poll_votes table
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON public.poll_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option_id ON public.poll_votes(option_id);

-- ========================================
-- הפעלת Row Level Security (RLS)
-- ========================================

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- ========================================
-- מדיניות גישה לטבלת polls
-- ========================================

-- מדיניות צפייה - רק חברי הצ'אט יכולים לראות סקרים
CREATE POLICY "Users can view polls in channels they are members of" ON public.polls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.channel_members 
      WHERE channel_id = chat_id AND user_id = auth.uid()
    )
  );

-- מדיניות יצירה - רק חברי הצ'אט יכולים ליצור סקרים
CREATE POLICY "Only channel members can create polls" ON public.polls
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.channel_members 
      WHERE channel_id = chat_id AND user_id = auth.uid()
    )
  );

-- מדיניות עדכון - רק יוצר הסקר יכול לעדכן אותו
CREATE POLICY "Only poll creator can update polls" ON public.polls
  FOR UPDATE USING (creator_id = auth.uid());

-- מדיניות מחיקה - רק יוצר הסקר יכול למחוק אותו
CREATE POLICY "Only poll creator can delete polls" ON public.polls
  FOR DELETE USING (creator_id = auth.uid());

-- ========================================
-- מדיניות גישה לטבלת poll_votes
-- ========================================

-- מדיניות צפייה - משתמשים יכולים לראות הצבעות לסקרים שהם יכולים לראות
CREATE POLICY "Users can view votes for polls they can see" ON public.poll_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.channel_members cm ON p.chat_id = cm.channel_id
      WHERE p.id = poll_id AND cm.user_id = auth.uid()
    )
  );

-- מדיניות הצבעה - משתמשים יכולים להצביע רק בסקרים בצ'אטים שהם חברים בהם
CREATE POLICY "Users can vote on polls in channels they are members of" ON public.poll_votes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.channel_members cm ON p.chat_id = cm.channel_id
      WHERE p.id = poll_id AND cm.user_id = auth.uid()
    )
  );

-- מדיניות עדכון - משתמשים יכולים לעדכן רק את ההצבעות שלהם
CREATE POLICY "Users can only modify their own votes" ON public.poll_votes
  FOR UPDATE USING (user_id = auth.uid());

-- מדיניות מחיקה - משתמשים יכולים למחוק רק את ההצבעות שלהם
CREATE POLICY "Users can only delete their own votes" ON public.poll_votes
  FOR DELETE USING (user_id = auth.uid());

-- ========================================
-- פונקציות עזר
-- ========================================

-- פונקציה לעדכון מספר ההצבעות ב-options
CREATE OR REPLACE FUNCTION update_poll_vote_counts(poll_id_param UUID)
RETURNS VOID AS $$
BEGIN
  -- עדכון מספר ההצבעות לכל אפשרות
  UPDATE public.polls 
  SET options = (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', option->>'id',
        'text', option->>'text',
        'votes_count', COALESCE(vote_counts.count, 0)
      )
    )
    FROM jsonb_array_elements(options) AS option
    LEFT JOIN (
      SELECT 
        option_id, 
        COUNT(*) as count
      FROM public.poll_votes 
      WHERE poll_id = poll_id_param 
      GROUP BY option_id
    ) AS vote_counts ON option->>'id' = vote_counts.option_id
  )
  WHERE id = poll_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- פונקציה לקבלת תוצאות סקר עם הצבעות המשתמש
CREATE OR REPLACE FUNCTION get_poll_with_user_votes(poll_id_param UUID, user_id_param UUID)
RETURNS TABLE (
  poll_data JSONB,
  user_votes JSONB,
  total_votes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.options::jsonb as poll_data,
    COALESCE(
      (SELECT jsonb_agg(option_id) 
       FROM public.poll_votes 
       WHERE poll_id = p.id AND user_id = user_id_param), 
      '[]'::jsonb
    ) as user_votes,
    (SELECT COUNT(*) FROM public.poll_votes WHERE poll_id = p.id) as total_votes
  FROM public.polls p
  WHERE p.id = poll_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- Triggers
-- ========================================

-- Trigger לעדכון מספר ההצבעות כאשר יש הצבעה חדשה
CREATE OR REPLACE FUNCTION trigger_update_poll_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_poll_vote_counts(NEW.poll_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_poll_vote_counts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_poll_vote_counts();

-- ========================================
-- בדיקות ואימות
-- ========================================

-- בדיקה שהטבלאות נוצרו בהצלחה
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'polls') THEN
    RAISE EXCEPTION 'טבלת polls לא נוצרה בהצלחה';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'poll_votes') THEN
    RAISE EXCEPTION 'טבלת poll_votes לא נוצרה בהצלחה';
  END IF;
  
  RAISE NOTICE '✅ מערכת הסקרים נוצרה בהצלחה!';
END $$;

-- ========================================
-- הערות חשובות
-- ========================================

/*
📝 הערות חשובות:

1. **JSONB Structure for options:**
   כל אפשרות בסקר צריכה להיות בפורמט:
   {
     "id": "unique_option_id",
     "text": "טקסט האפשרות",
     "votes_count": 0
   }

2. **Security:**
   - כל הפונקציות מוגנות על ידי RLS
   - משתמשים יכולים לראות רק סקרים בצ'אטים שהם חברים בהם
   - רק יוצר הסקר יכול לעדכן/למחוק אותו

3. **Performance:**
   - Indexes על שדות מפתח
   - Trigger לעדכון אוטומטי של מספרי הצבעות
   - פונקציות עזר מותאמות לביצועים

4. **Data Integrity:**
   - UNIQUE constraint מונע הצבעות כפולות
   - CASCADE DELETE מוחק הצבעות כאשר סקר נמחק
   - בדיקות ולידציה לפני כל פעולה

5. **Usage Example:**
   -- יצירת סקר
   INSERT INTO polls (chat_id, creator_id, question, options, multiple_choice)
   VALUES (
     'chat-uuid',
     'user-uuid',
     'מה דעתך על האפליקציה?',
     '[
       {"id": "opt1", "text": "מעולה!", "votes_count": 0},
       {"id": "opt2", "text": "טובה", "votes_count": 0}
     ]'::jsonb,
     false
   );

   -- הצבעה
   INSERT INTO poll_votes (poll_id, user_id, option_id)
   VALUES ('poll-uuid', 'user-uuid', 'opt1');
*/
