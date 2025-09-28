-- Drop existing tables
DROP TABLE IF EXISTS public.channel_members CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.channels CASCADE;
DROP TABLE IF EXISTS public.dm_conversations CASCADE;
DROP TABLE IF EXISTS public.dm_messages CASCADE;
DROP TABLE IF EXISTS public.chats CASCADE;

-- Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  full_name TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  profile_picture TEXT,
  account_type TEXT,
  track_id TEXT,
  intro_data JSONB, -- כל נתוני ההרשמה (markets, experience, styles, brokers, level, goal, communityGoals, hours, socials, heardFrom, wish)
  registration_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_online BOOLEAN DEFAULT FALSE,
  
  -- בדיקות תקינות
  CONSTRAINT valid_phone CHECK (phone ~ '^[0-9]{10,15}$'),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT valid_track_id CHECK (track_id IN ('1', '2', '3'))
);

-- Create channels table
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  avatar_url TEXT,
  icon_name TEXT,
  description TEXT,
  image_url TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_private BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create channel members table
CREATE TABLE IF NOT EXISTS public.channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin' או 'member'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content TEXT,
  file_url TEXT,
  type TEXT DEFAULT 'channel', -- 'channel' or 'dm'
  recipient_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- for DM
  poll_id UUID REFERENCES public.polls(id) ON DELETE SET NULL, -- for poll messages
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reply_to uuid REFERENCES messages(id),
  status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read'
  read_by JSONB DEFAULT '[]' -- array of user IDs who read the message
);

-- Create dm conversations table
CREATE TABLE IF NOT EXISTS public.dm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user1_id, user2_id)
);

-- Create dm messages table
CREATE TABLE IF NOT EXISTS public.dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content TEXT,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON public.channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON public.channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_user1_id ON public.dm_conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_user2_id ON public.dm_conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation_id ON public.dm_messages(conversation_id);

-- Create indexes for user registration data
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_track_id ON public.users(track_id);
CREATE INDEX IF NOT EXISTS idx_users_registration_completed ON public.users(registration_completed);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for channels
CREATE POLICY "View channels for members" ON public.channels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.channel_members cm WHERE cm.channel_id = public.channels.id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Create channels" ON public.channels
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Create RLS policies for channel members
CREATE POLICY "View own channel memberships" ON public.channel_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Join channels" ON public.channel_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for messages
CREATE POLICY "View messages in own channels" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.channel_members cm WHERE cm.channel_id = public.messages.channel_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Send messages in own channels" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.channel_members cm WHERE cm.channel_id = public.messages.channel_id AND cm.user_id = auth.uid()
    ) AND auth.uid() = sender_id
  );

-- Create RLS policies for dm conversations
CREATE POLICY "View own DM conversations" ON public.dm_conversations
  FOR SELECT USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- Create RLS policies for dm messages
CREATE POLICY "View own DM messages" ON public.dm_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.dm_conversations dc WHERE dc.id = public.dm_messages.conversation_id AND (dc.user1_id = auth.uid() OR dc.user2_id = auth.uid())
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channel_members_updated_at BEFORE UPDATE ON public.channel_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, display_name, email, full_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to check if email already exists
CREATE OR REPLACE FUNCTION check_email_exists(email_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM public.users WHERE email = email_to_check);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if phone already exists
CREATE OR REPLACE FUNCTION check_phone_exists(phone_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM public.users WHERE phone = phone_to_check);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to complete user registration
CREATE OR REPLACE FUNCTION complete_user_registration(
  user_id UUID,
  user_full_name TEXT,
  user_phone TEXT,
  user_track_id TEXT,
  user_intro_data JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  -- בדיקה שהמשתמש קיים
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id = user_id) THEN
    RETURN FALSE;
  END IF;
  
  -- בדיקה שהטלפון לא קיים אצל משתמש אחר
  IF user_phone IS NOT NULL AND EXISTS(SELECT 1 FROM public.users WHERE phone = user_phone AND id != user_id) THEN
    RETURN FALSE;
  END IF;
  
  -- עדכון הנתונים
  UPDATE public.users 
  SET 
    full_name = user_full_name,
    phone = user_phone,
    track_id = user_track_id,
    intro_data = user_intro_data,
    registration_completed = TRUE,
    updated_at = NOW()
  WHERE id = user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create storage bucket for chat files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for chat files
CREATE POLICY "Chat files are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-files');

CREATE POLICY "Authenticated users can upload chat files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'chat-files' AND auth.role() = 'authenticated'); 

-- Polls System Tables
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

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL, -- References the option id from the JSONB options array
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_id, user_id, option_id) -- Prevent duplicate votes from same user on same option
);

-- RLS Policies for polls
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Polls policies
CREATE POLICY "Users can view polls in channels they are members of" ON public.polls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.channel_members 
      WHERE channel_id = chat_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Only channel members can create polls" ON public.polls
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.channel_members 
      WHERE channel_id = chat_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Only poll creator can update/delete polls" ON public.polls
  FOR ALL USING (creator_id = auth.uid());

-- Poll votes policies
CREATE POLICY "Users can view votes for polls they can see" ON public.poll_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.channel_members cm ON p.chat_id = cm.channel_id
      WHERE p.id = poll_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can vote on polls in channels they are members of" ON public.poll_votes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.channel_members cm ON p.chat_id = cm.channel_id
      WHERE p.id = poll_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can only modify their own votes" ON public.poll_votes
  FOR ALL USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_polls_chat_id ON public.polls(chat_id);
CREATE INDEX IF NOT EXISTS idx_polls_creator_id ON public.polls(creator_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON public.poll_votes(user_id); 