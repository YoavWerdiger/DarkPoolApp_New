-- Add mentions column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS mentions JSONB NULL;

-- Add index for mentions column
CREATE INDEX IF NOT EXISTS idx_messages_mentions ON public.messages USING GIN (mentions);

-- Add comment to explain the column
COMMENT ON COLUMN public.messages.mentions IS 'Array of mention objects with user_id, start, end, and display properties';
