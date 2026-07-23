-- Add group_id column to reactions table for efficient filtering
ALTER TABLE public.chat_message_reactions
ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.chat_groups(id);

-- Backfill existing reactions with group_id from their parent message
UPDATE public.chat_message_reactions r
SET group_id = m.group_id
FROM public.chat_messages m
WHERE r.message_id = m.id
  AND r.group_id IS NULL;

-- Trigger to auto-populate group_id on new reactions
CREATE OR REPLACE FUNCTION set_reaction_group_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  SELECT group_id INTO NEW.group_id
  FROM public.chat_messages
  WHERE id = NEW.message_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_reaction_group_id ON public.chat_message_reactions;

CREATE TRIGGER trg_set_reaction_group_id
BEFORE INSERT ON public.chat_message_reactions
FOR EACH ROW
EXECUTE FUNCTION set_reaction_group_id();

-- Index for filtering reactions by group
CREATE INDEX IF NOT EXISTS idx_reactions_group_id
ON public.chat_message_reactions(group_id);
