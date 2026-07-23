-- ============================================
-- דיווחי הודעות — צפייה וטיפול רק למנהלי הקבוצה
-- ============================================
-- הרץ ב-Supabase SQL Editor (אחרי chat_system_schema.sql).
-- משתמש רגיל: עדיין יוצר דיווח (INSERT) ורואה רק דיווחים משלו (מדיניות קיימת).
-- מנהל קבוצה (role = 'admin' ב-chat_group_members לאותה קבוצה כמו ההודעה):
--   רואה את כל הדיווחים על הודעות בקבוצה, ויכול לעדכן סטטוס (reviewed / resolved וכו').
-- ============================================

DROP POLICY IF EXISTS "Group admins can view reports for their groups" ON public.chat_message_reports;
CREATE POLICY "Group admins can view reports for their groups"
  ON public.chat_message_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_messages cm
      JOIN public.chat_group_members cgm
        ON cgm.group_id = cm.group_id
       AND cgm.user_id = auth.uid()
       AND cgm.role = 'admin'
      WHERE cm.id = chat_message_reports.message_id
    )
  );

DROP POLICY IF EXISTS "Group admins can update report status" ON public.chat_message_reports;
CREATE POLICY "Group admins can update report status"
  ON public.chat_message_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_messages cm
      JOIN public.chat_group_members cgm
        ON cgm.group_id = cm.group_id
       AND cgm.user_id = auth.uid()
       AND cgm.role = 'admin'
      WHERE cm.id = chat_message_reports.message_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.chat_messages cm
      JOIN public.chat_group_members cgm
        ON cgm.group_id = cm.group_id
       AND cgm.user_id = auth.uid()
       AND cgm.role = 'admin'
      WHERE cm.id = chat_message_reports.message_id
    )
  );

-- אין מדיניות DELETE למשתמשים — מחיקה רק דרך service role / דשבורד אם נדרש.
