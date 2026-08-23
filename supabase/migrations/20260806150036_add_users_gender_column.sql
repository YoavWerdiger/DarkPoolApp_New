-- Edit Profile saves gender as 'male' | 'female'
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS gender text;

COMMENT ON COLUMN public.users.gender IS 'User gender: male | female';
