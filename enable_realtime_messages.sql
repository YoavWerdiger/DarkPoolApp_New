-- הפעלת Realtime עבור טבלת messages
-- הסבר: כדי ש-Realtime יעבוד ב-Supabase, צריך להגדיר REPLICA IDENTITY

-- 1. הפעלת REPLICA IDENTITY על טבלת messages
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 2. הפעלת REPLICA IDENTITY על טבלאות נוספות (לבטיחות)
ALTER TABLE public.channels REPLICA IDENTITY FULL;
ALTER TABLE public.channel_members REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;

-- 3. יצירת אינדקסים נוספים לביצועים טובים יותר של Realtime
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON public.messages(channel_id, created_at DESC);

-- 4. עדכון הגדרות RLS למניעת בעיות עם Realtime
-- ודא שיש גישה לכל המשתמשים בערוץ לראות הודעות חדשות
DROP POLICY IF EXISTS "View messages in own channels" ON public.messages;
CREATE POLICY "View messages in own channels" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.channel_members cm 
      WHERE cm.channel_id = public.messages.channel_id 
      AND cm.user_id = auth.uid()
    )
  );

-- 5. הוספת policy ל-UPDATE על messages (לתמיכה בעריכת הודעות)
DROP POLICY IF EXISTS "Update own messages" ON public.messages;
CREATE POLICY "Update own messages" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id);

-- 6. הוספת policy ל-DELETE על messages (לתמיכה במחיקת הודעות)
DROP POLICY IF EXISTS "Delete own messages" ON public.messages;
CREATE POLICY "Delete own messages" ON public.messages
  FOR DELETE USING (auth.uid() = sender_id);

-- הצלחה! עכשיו Realtime אמור לעבוד

