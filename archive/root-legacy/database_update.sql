-- Update existing users table with new columns
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS track_id TEXT,
ADD COLUMN IF NOT EXISTS intro_data JSONB,
ADD COLUMN IF NOT EXISTS registration_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add constraints if they don't exist
DO $$ 
BEGIN
    -- Add phone validation constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_phone' AND table_name = 'users'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT valid_phone CHECK (phone ~ '^[0-9]{10,15}$');
    END IF;
    
    -- Add email validation constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_email' AND table_name = 'users'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
    END IF;
    
    -- Add track_id validation constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_track_id' AND table_name = 'users'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT valid_track_id CHECK (track_id IN ('1', '2', '3'));
    END IF;
END $$;

-- Create indexes for user registration data (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_track_id ON public.users(track_id);
CREATE INDEX IF NOT EXISTS idx_users_registration_completed ON public.users(registration_completed);

-- Update existing users to have email from auth.users if not set
UPDATE public.users 
SET email = auth.users.email 
FROM auth.users 
WHERE public.users.id = auth.users.id 
AND public.users.email IS NULL;

-- Create function to check if email already exists (if it doesn't exist)
CREATE OR REPLACE FUNCTION check_email_exists(email_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM public.users WHERE email = email_to_check);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if phone already exists (if it doesn't exist)
CREATE OR REPLACE FUNCTION check_phone_exists(phone_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM public.users WHERE phone = phone_to_check);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to complete user registration (if it doesn't exist)
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

-- Update the handle_new_user function to include new fields
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

-- Add RLS policy for insert if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' AND policyname = 'Users can insert their own profile'
    ) THEN
        CREATE POLICY "Users can insert their own profile" ON public.users
        FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
END $$; 