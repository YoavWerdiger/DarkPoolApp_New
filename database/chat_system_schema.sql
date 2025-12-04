-- ============================================
-- מערכת צ'אט חדשה - DarkPool Chat System
-- ============================================
-- מערכת צ'אט קבוצתי מלאה בסגנון וואטסאפ
-- Real-time, Media support, Reactions, ועוד
-- ============================================

-- Drop existing tables if needed (בשלב הראשון לא נמחק, רק ניצור)
-- אבל נכין את הסקריפט למקרה שנרצה למחוק בעתיד

-- ============================================
-- 1. טבלת קבוצות
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- מטא-דאטה
  members_count INTEGER DEFAULT 0,
  messages_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_preview TEXT,
  
  -- הגדרות
  settings JSONB DEFAULT '{
    "muteNotifications": false,
    "onlyAdminsCanSend": false,
    "onlyAdminsCanEditInfo": true,
    "showJoinMessages": true,
    "allowMembersToAddOthers": false
  }'::jsonb
);

-- ============================================
-- 2. טבלת חברי קבוצה
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'admin', 'member'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- הגדרות אישיות לקבוצה
  muted BOOLEAN DEFAULT FALSE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  
  -- מעקב אחר קריאה
  last_read_message_id UUID,
  last_read_at TIMESTAMP WITH TIME ZONE,
  
  -- מטא-דאטה
  unread_count INTEGER DEFAULT 0,
  mentioned_count INTEGER DEFAULT 0, -- כמה פעמים תייגו אותו
  
  UNIQUE(group_id, user_id)
);

-- ============================================
-- 3. טבלת הודעות
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- תוכן ההודעה
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'image', 'video', 'audio', 'document', 'system'
  
  -- מדיה
  media_url TEXT,
  media_thumbnail_url TEXT,
  media_type TEXT, -- 'image/jpeg', 'video/mp4', 'audio/mpeg', 'application/pdf', etc.
  media_size INTEGER, -- בבייטים
  media_duration INTEGER, -- לסרטונים ואודיו - בשניות
  media_width INTEGER, -- לתמונות וסרטונים
  media_height INTEGER, -- לתמונות וסרטונים
  media_file_name TEXT,
  
  -- השבה (Reply)
  reply_to_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  
  -- העברה (Forward)
  forwarded_from_group_id UUID REFERENCES public.chat_groups(id) ON DELETE SET NULL,
  forwarded_from_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  is_forwarded BOOLEAN DEFAULT FALSE,
  
  -- תיוג משתמשים (@mentions)
  mentioned_users UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- סטטוס
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_for_everyone BOOLEAN DEFAULT FALSE,
  
  -- הודעה שקטה (silent)
  is_silent BOOLEAN DEFAULT FALSE,
  
  -- הודעת מערכת (למשל "X הצטרף לקבוצה")
  is_system_message BOOLEAN DEFAULT FALSE,
  system_message_type TEXT, -- 'user_joined', 'user_left', 'group_created', etc.
  system_message_data JSONB,
  
  -- זמנים
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- מטא-דאטה
  reactions_count INTEGER DEFAULT 0,
  read_by_count INTEGER DEFAULT 0,
  
  -- אינדקסים
  CONSTRAINT valid_message_type CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'system'))
);

-- ============================================
-- 4. טבלת ריאקציות להודעות
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL, -- '👍', '❤️', '😂', '😮', '😢', '🙏'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(message_id, user_id, emoji)
);

-- ============================================
-- 5. טבלת הודעות מועדפות (Starred Messages)
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_starred_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  starred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(message_id, user_id)
);

-- ============================================
-- 6. טבלת אישורי קריאה (Read Receipts)
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(message_id, user_id)
);

-- ============================================
-- 7. טבלת Typing Indicators
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  started_typing_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(group_id, user_id)
);

-- ============================================
-- 8. טבלת דיווחים (Reports)
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_message_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  CONSTRAINT valid_report_status CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed'))
);

-- ============================================
-- אינדקסים לביצועים
-- ============================================

-- אינדקסים לקבוצות
CREATE INDEX IF NOT EXISTS idx_chat_groups_created_by ON public.chat_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_groups_last_message_at ON public.chat_groups(last_message_at DESC);

-- אינדקסים לחברי קבוצה
CREATE INDEX IF NOT EXISTS idx_chat_group_members_group_id ON public.chat_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_user_id ON public.chat_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_role ON public.chat_group_members(role);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_unread ON public.chat_group_members(user_id, unread_count) WHERE unread_count > 0;

-- אינדקסים להודעות
CREATE INDEX IF NOT EXISTS idx_chat_messages_group_id ON public.chat_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to ON public.chat_messages(reply_to_message_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_type ON public.chat_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
-- חיפוש טקסט (simple עובד עם כל השפות כולל עברית)
CREATE INDEX IF NOT EXISTS idx_chat_messages_search ON public.chat_messages USING gin(to_tsvector('simple', content)) WHERE content IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_mentioned ON public.chat_messages USING gin(mentioned_users);
CREATE INDEX IF NOT EXISTS idx_chat_messages_media ON public.chat_messages(group_id, message_type, created_at DESC) WHERE message_type IN ('image', 'video');

-- אינדקסים לריאקציות
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message_id ON public.chat_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_user_id ON public.chat_message_reactions(user_id);

-- אינדקסים להודעות מועדפות
CREATE INDEX IF NOT EXISTS idx_chat_starred_user_id ON public.chat_starred_messages(user_id, starred_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_starred_group_id ON public.chat_starred_messages(group_id);

-- אינדקסים לקריאה
CREATE INDEX IF NOT EXISTS idx_chat_reads_message_id ON public.chat_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_reads_user_id ON public.chat_message_reads(user_id);

-- אינדקסים ל-typing
CREATE INDEX IF NOT EXISTS idx_chat_typing_group_id ON public.chat_typing_indicators(group_id, started_typing_at DESC);

-- אינדקסים לדיווחים
CREATE INDEX IF NOT EXISTS idx_chat_reports_status ON public.chat_message_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_reports_message_id ON public.chat_message_reports(message_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_starred_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies - קבוצות
-- ============================================

-- צפייה בקבוצות - רק חברים יכולים לראות
CREATE POLICY "Members can view their groups" ON public.chat_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_group_members 
      WHERE chat_group_members.group_id = chat_groups.id 
      AND chat_group_members.user_id = auth.uid()
    )
  );

-- יצירת קבוצות - כל משתמש מחובר יכול
CREATE POLICY "Authenticated users can create groups" ON public.chat_groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- עדכון קבוצות - רק אדמינים
CREATE POLICY "Admins can update groups" ON public.chat_groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.chat_group_members 
      WHERE chat_group_members.group_id = chat_groups.id 
      AND chat_group_members.user_id = auth.uid()
      AND chat_group_members.role = 'admin'
    )
  );

-- מחיקת קבוצות - רק מי שיצר
CREATE POLICY "Creators can delete groups" ON public.chat_groups
  FOR DELETE USING (auth.uid() = created_by);

-- ============================================
-- RLS Policies - חברי קבוצה
-- ============================================

-- צפייה בחברים - רק חברי הקבוצה
CREATE POLICY "Members can view group members" ON public.chat_group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_group_members cm
      WHERE cm.group_id = chat_group_members.group_id 
      AND cm.user_id = auth.uid()
    )
  );

-- הוספת חברים - רק אדמינים
CREATE POLICY "Admins can add members" ON public.chat_group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_group_members 
      WHERE chat_group_members.group_id = group_id 
      AND chat_group_members.user_id = auth.uid()
      AND chat_group_members.role = 'admin'
    )
  );

-- עדכון חברים - אדמינים או המשתמש עצמו (להגדרות אישיות)
CREATE POLICY "Members can update own settings, admins can update all" ON public.chat_group_members
  FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.chat_group_members cm
      WHERE cm.group_id = chat_group_members.group_id 
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    )
  );

-- הסרת חברים - רק אדמינים או המשתמש עצמו (עזיבת קבוצה)
CREATE POLICY "Admins can remove members, users can leave" ON public.chat_group_members
  FOR DELETE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.chat_group_members cm
      WHERE cm.group_id = chat_group_members.group_id 
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    )
  );

-- ============================================
-- RLS Policies - הודעות
-- ============================================

-- צפייה בהודעות - רק חברי הקבוצה
CREATE POLICY "Members can view group messages" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_group_members 
      WHERE chat_group_members.group_id = chat_messages.group_id 
      AND chat_group_members.user_id = auth.uid()
    )
  );

-- שליחת הודעות - חברי הקבוצה (בהתאם להגדרות)
CREATE POLICY "Members can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.chat_group_members 
      WHERE chat_group_members.group_id = group_id 
      AND chat_group_members.user_id = auth.uid()
    )
  );

-- עדכון הודעות - רק השולח (לעריכה)
CREATE POLICY "Senders can edit their messages" ON public.chat_messages
  FOR UPDATE USING (auth.uid() = sender_id);

-- מחיקת הודעות - השולח או אדמינים
CREATE POLICY "Senders and admins can delete messages" ON public.chat_messages
  FOR DELETE USING (
    auth.uid() = sender_id OR
    EXISTS (
      SELECT 1 FROM public.chat_group_members 
      WHERE chat_group_members.group_id = chat_messages.group_id 
      AND chat_group_members.user_id = auth.uid()
      AND chat_group_members.role = 'admin'
    )
  );

-- ============================================
-- RLS Policies - ריאקציות
-- ============================================

CREATE POLICY "Members can view reactions" ON public.chat_message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages m
      JOIN public.chat_group_members gm ON gm.group_id = m.group_id
      WHERE m.id = chat_message_reactions.message_id 
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can add reactions" ON public.chat_message_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions" ON public.chat_message_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS Policies - הודעות מועדפות
-- ============================================

CREATE POLICY "Users can view own starred messages" ON public.chat_starred_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can star messages" ON public.chat_starred_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unstar messages" ON public.chat_starred_messages
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS Policies - אישורי קריאה
-- ============================================

CREATE POLICY "Members can view read receipts" ON public.chat_message_reads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages m
      JOIN public.chat_group_members gm ON gm.group_id = m.group_id
      WHERE m.id = chat_message_reads.message_id 
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can mark messages as read" ON public.chat_message_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RLS Policies - Typing Indicators
-- ============================================

CREATE POLICY "Members can view typing indicators" ON public.chat_typing_indicators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_group_members 
      WHERE chat_group_members.group_id = chat_typing_indicators.group_id 
      AND chat_group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can set own typing status" ON public.chat_typing_indicators
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- RLS Policies - דיווחים
-- ============================================

CREATE POLICY "Users can view own reports" ON public.chat_message_reports
  FOR SELECT USING (auth.uid() = reported_by);

CREATE POLICY "Users can create reports" ON public.chat_message_reports
  FOR INSERT WITH CHECK (auth.uid() = reported_by);

-- ============================================
-- טריגרים ופונקציות
-- ============================================

-- פונקציה לעדכון updated_at
CREATE OR REPLACE FUNCTION update_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- טריגר לעדכון updated_at בקבוצות
CREATE TRIGGER update_chat_groups_updated_at
  BEFORE UPDATE ON public.chat_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_updated_at();

-- פונקציה לעדכון last_message בקבוצה
CREATE OR REPLACE FUNCTION update_group_last_message()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.chat_groups
    SET 
      last_message_at = NEW.created_at,
      last_message_preview = LEFT(COALESCE(NEW.content, 
        CASE 
          WHEN NEW.message_type = 'image' THEN '📷 תמונה'
          WHEN NEW.message_type = 'video' THEN '🎥 סרטון'
          WHEN NEW.message_type = 'audio' THEN '🎤 הודעה קולית'
          WHEN NEW.message_type = 'document' THEN '📎 מסמך'
          ELSE ''
        END
      ), 100),
      messages_count = messages_count + 1
    WHERE id = NEW.group_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- טריגר לעדכון הודעה אחרונה
CREATE TRIGGER update_group_last_message_trigger
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_group_last_message();

-- פונקציה לעדכון מספר חברים בקבוצה
CREATE OR REPLACE FUNCTION update_group_members_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.chat_groups
    SET members_count = members_count + 1
    WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.chat_groups
    SET members_count = members_count - 1
    WHERE id = OLD.group_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- טריגר לעדכון מספר חברים
CREATE TRIGGER update_group_members_count_trigger
  AFTER INSERT OR DELETE ON public.chat_group_members
  FOR EACH ROW
  EXECUTE FUNCTION update_group_members_count();

-- פונקציה לעדכון מספר ריאקציות
CREATE OR REPLACE FUNCTION update_message_reactions_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.chat_messages
    SET reactions_count = reactions_count + 1
    WHERE id = NEW.message_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.chat_messages
    SET reactions_count = reactions_count - 1
    WHERE id = OLD.message_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- טריגר לעדכון ריאקציות
CREATE TRIGGER update_message_reactions_count_trigger
  AFTER INSERT OR DELETE ON public.chat_message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_message_reactions_count();

-- פונקציה לעדכון מספר קוראים
CREATE OR REPLACE FUNCTION update_message_read_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.chat_messages
    SET read_by_count = read_by_count + 1
    WHERE id = NEW.message_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- טריגר לעדכון קריאה
CREATE TRIGGER update_message_read_count_trigger
  AFTER INSERT ON public.chat_message_reads
  FOR EACH ROW
  EXECUTE FUNCTION update_message_read_count();

-- פונקציה לניקוי typing indicators ישנים (מעל 10 שניות)
CREATE OR REPLACE FUNCTION cleanup_old_typing_indicators()
RETURNS void AS $$
BEGIN
  DELETE FROM public.chat_typing_indicators
  WHERE started_typing_at < NOW() - INTERVAL '10 seconds';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- פונקציות עזר לשאילתות
-- ============================================

-- פונקציה לקבלת הודעות עם כל הפרטים
CREATE OR REPLACE FUNCTION get_chat_messages(
  p_group_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  group_id UUID,
  sender_id UUID,
  sender_name TEXT,
  sender_avatar TEXT,
  content TEXT,
  message_type TEXT,
  media_url TEXT,
  media_thumbnail_url TEXT,
  media_type TEXT,
  media_size INTEGER,
  media_duration INTEGER,
  media_width INTEGER,
  media_height INTEGER,
  media_file_name TEXT,
  reply_to_message_id UUID,
  reply_to_content TEXT,
  reply_to_sender_name TEXT,
  is_forwarded BOOLEAN,
  mentioned_users UUID[],
  is_edited BOOLEAN,
  edited_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN,
  is_silent BOOLEAN,
  is_system_message BOOLEAN,
  system_message_type TEXT,
  system_message_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  reactions_count INTEGER,
  read_by_count INTEGER,
  reactions JSONB,
  is_starred_by_me BOOLEAN,
  is_read_by_me BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.group_id,
    m.sender_id,
    u.display_name as sender_name,
    u.profile_picture as sender_avatar,
    m.content,
    m.message_type,
    m.media_url,
    m.media_thumbnail_url,
    m.media_type,
    m.media_size,
    m.media_duration,
    m.media_width,
    m.media_height,
    m.media_file_name,
    m.reply_to_message_id,
    rm.content as reply_to_content,
    ru.display_name as reply_to_sender_name,
    m.is_forwarded,
    m.mentioned_users,
    m.is_edited,
    m.edited_at,
    m.is_deleted,
    m.is_silent,
    m.is_system_message,
    m.system_message_type,
    m.system_message_data,
    m.created_at,
    m.reactions_count,
    m.read_by_count,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'emoji', r.emoji,
          'count', COUNT(*),
          'users', jsonb_agg(jsonb_build_object('id', r.user_id, 'name', ur.display_name))
        )
      )
      FROM public.chat_message_reactions r
      LEFT JOIN public.users ur ON ur.id = r.user_id
      WHERE r.message_id = m.id
      GROUP BY r.emoji
    ) as reactions,
    EXISTS(
      SELECT 1 FROM public.chat_starred_messages 
      WHERE message_id = m.id AND user_id = auth.uid()
    ) as is_starred_by_me,
    EXISTS(
      SELECT 1 FROM public.chat_message_reads 
      WHERE message_id = m.id AND user_id = auth.uid()
    ) as is_read_by_me
  FROM public.chat_messages m
  LEFT JOIN public.users u ON u.id = m.sender_id
  LEFT JOIN public.chat_messages rm ON rm.id = m.reply_to_message_id
  LEFT JOIN public.users ru ON ru.id = rm.sender_id
  WHERE m.group_id = p_group_id
  AND m.is_deleted = FALSE
  ORDER BY m.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- פונקציה לחיפוש הודעות
CREATE OR REPLACE FUNCTION search_chat_messages(
  p_group_id UUID,
  p_search_term TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  group_id UUID,
  sender_id UUID,
  sender_name TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.group_id,
    m.sender_id,
    u.display_name as sender_name,
    m.content,
    m.created_at,
    ts_rank(to_tsvector('simple', m.content), plainto_tsquery('simple', p_search_term)) as rank
  FROM public.chat_messages m
  LEFT JOIN public.users u ON u.id = m.sender_id
  WHERE m.group_id = p_group_id
  AND m.is_deleted = FALSE
  AND m.content IS NOT NULL
  AND to_tsvector('simple', m.content) @@ plainto_tsquery('simple', p_search_term)
  ORDER BY rank DESC, m.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- הוספת עמודת last_active ל-users אם לא קיימת
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'last_active'
    ) THEN
        ALTER TABLE public.users ADD COLUMN last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- אינדקס ל-last_active
CREATE INDEX IF NOT EXISTS idx_users_last_active ON public.users(last_active DESC);

-- ============================================
-- הגדרת Realtime Publication
-- ============================================

-- להפעיל Realtime על כל הטבלאות החדשות
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_typing_indicators;

-- ============================================
-- DONE! מערכת הצ'אט מוכנה!
-- ============================================
-- להריץ את הסקריפט הזה ב-Supabase SQL Editor
-- ============================================

