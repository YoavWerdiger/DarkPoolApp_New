-- ============================================
-- Fix Unread Messages System
-- ============================================
-- הרצה ב-Supabase SQL Editor
-- 
-- חשוב: הרץ את הקובץ הזה במלואו ב-Supabase SQL Editor
-- כדי ליצור את הפונקציות RPC שמעקפות את ה-RLS
-- ============================================

-- 1. וידוא שטבלת chat_message_reads קיימת
CREATE TABLE IF NOT EXISTS chat_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_message_id ON chat_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_user_id ON chat_message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_group_id ON chat_message_reads(group_id);

-- 2. וידוא שעמודות unread קיימות בטבלת chat_group_members
DO $$ 
BEGIN
  -- unread_count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_group_members' AND column_name = 'unread_count'
  ) THEN
    ALTER TABLE chat_group_members ADD COLUMN unread_count integer DEFAULT 0;
  END IF;
  
  -- mentioned_count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_group_members' AND column_name = 'mentioned_count'
  ) THEN
    ALTER TABLE chat_group_members ADD COLUMN mentioned_count integer DEFAULT 0;
  END IF;
  
  -- last_read_message_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_group_members' AND column_name = 'last_read_message_id'
  ) THEN
    ALTER TABLE chat_group_members ADD COLUMN last_read_message_id uuid REFERENCES chat_messages(id);
  END IF;
  
  -- last_read_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_group_members' AND column_name = 'last_read_at'
  ) THEN
    ALTER TABLE chat_group_members ADD COLUMN last_read_at timestamptz DEFAULT now();
  END IF;
END $$;

-- 3. RLS עבור chat_message_reads
ALTER TABLE chat_message_reads ENABLE ROW LEVEL SECURITY;

-- מחיקת פוליסות קיימות
DROP POLICY IF EXISTS "Users can view their own read receipts" ON chat_message_reads;
DROP POLICY IF EXISTS "Users can insert their own read receipts" ON chat_message_reads;
DROP POLICY IF EXISTS "Users can update their own read receipts" ON chat_message_reads;

-- פוליסות חדשות
CREATE POLICY "Users can view their own read receipts" ON chat_message_reads
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own read receipts" ON chat_message_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own read receipts" ON chat_message_reads
  FOR UPDATE USING (user_id = auth.uid());

-- 4. RLS עבור chat_group_members
ALTER TABLE chat_group_members ENABLE ROW LEVEL SECURITY;

-- מחיקת כל הפוליסות הקיימות כדי למנוע כפילויות
DROP POLICY IF EXISTS "Members can view group memberships" ON chat_group_members;
DROP POLICY IF EXISTS "Members can view own membership" ON chat_group_members;
DROP POLICY IF EXISTS "Members can update their own membership" ON chat_group_members;
DROP POLICY IF EXISTS "Members can insert their own membership" ON chat_group_members;
DROP POLICY IF EXISTS "Admins can add members" ON chat_group_members;
DROP POLICY IF EXISTS "Admins can remove members, users can leave" ON chat_group_members;
DROP POLICY IF EXISTS "Members can update own settings, admins can update all" ON chat_group_members;
DROP POLICY IF EXISTS "Users can join groups" ON chat_group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON chat_group_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON chat_group_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON chat_group_members;

-- פוליסות חדשות
-- חשוב: לא להשתמש ב-EXISTS או IN עם subquery ל-chat_group_members כדי למנוע רקורסיה
-- נשתמש ב-function helper עם SECURITY DEFINER כדי לעקוף RLS

-- Function helper לבדיקת חברות בקבוצה (עוקף RLS)
CREATE OR REPLACE FUNCTION public.is_user_member_of_group(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

-- Policy יחיד: משתמש יכול לראות את החברות שלו עצמו + חברים אחרים בקבוצות שהוא חבר בהן
-- נשתמש ב-function helper עם SECURITY DEFINER כדי למנוע רקורסיה
CREATE POLICY "Members can view group memberships" ON chat_group_members
  FOR SELECT USING (
    -- אם זה המשתמש עצמו, תמיד אפשר
    user_id = auth.uid() OR
    -- אם המשתמש חבר בקבוצה, הוא יכול לראות את כל החברים
    public.is_user_member_of_group(group_id, auth.uid())
  );

CREATE POLICY "Members can update their own membership" ON chat_group_members
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Members can insert their own membership" ON chat_group_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 5. פונקציית RPC להגדלת unread_count
-- ⚠️ אל תריץ את הגרסה הישנה (2 פרמטרים) — גורמת ל-42725 "function is not unique".
-- השתמש ב: database/fix_increment_unread_count_ambiguity.sql

-- 6. פונקציה לאיפוס unread_count כשקוראים הודעות
-- חשוב: הפונקציה משתמשת ב-SECURITY DEFINER כדי לעקוף RLS
CREATE OR REPLACE FUNCTION public.reset_unread_count(
  p_group_id uuid,
  p_user_id uuid,
  p_last_read_message_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE chat_group_members
  SET 
    unread_count = 0,
    mentioned_count = 0,
    last_read_message_id = p_last_read_message_id,
    last_read_at = now()
  WHERE group_id = p_group_id
  AND user_id = p_user_id;
END;
$$;

-- 6.1. הרשאות RPC לפונקציות
-- GRANT ל-increment_unread_count: ראה fix_increment_unread_count_ambiguity.sql
GRANT EXECUTE ON FUNCTION public.reset_unread_count(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_unread_count(uuid, uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_user_member_of_group(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_member_of_group(uuid, uuid) TO anon;

-- 7. בדיקה - הצגת המבנה הנוכחי
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'chat_group_members'
ORDER BY ordinal_position;

-- 8. בדיקת RLS
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('chat_message_reads', 'chat_group_members');

-- 9. בדיקת נתוני unread נוכחיים
SELECT 
  cgm.user_id,
  u.display_name,
  cg.name as group_name,
  cgm.unread_count,
  cgm.mentioned_count,
  cgm.last_read_message_id,
  cgm.last_read_at
FROM chat_group_members cgm
JOIN chat_groups cg ON cg.id = cgm.group_id
JOIN users u ON u.id = cgm.user_id
ORDER BY cg.name, u.display_name;

