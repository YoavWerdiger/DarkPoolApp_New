-- סקריפט לתיקון פוליסות RLS להודעות
-- הרץ את זה ב-Supabase SQL Editor

-- מחק פוליסות קיימות
DROP POLICY IF EXISTS "View messages in own channels" ON public.messages;
DROP POLICY IF EXISTS "Send messages in own channels" ON public.messages;

-- צור פוליסות חדשות ומשופרות
CREATE POLICY "View messages in own channels" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.channel_members cm 
      WHERE cm.channel_id = public.messages.channel_id 
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Send messages in own channels" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.channel_members cm 
      WHERE cm.channel_id = public.messages.channel_id 
      AND cm.user_id = auth.uid()
    ) 
    AND auth.uid() = sender_id
  );

-- הוסף פוליסה לעדכון הודעות (לסטטוס read)
CREATE POLICY "Update own messages" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.channel_members cm 
      WHERE cm.channel_id = public.messages.channel_id 
      AND cm.user_id = auth.uid()
    )
  );

-- בדוק שהפוליסות נוצרו
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'messages'
ORDER BY policyname; 