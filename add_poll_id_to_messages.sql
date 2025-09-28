-- הוספת עמודת poll_id לטבלת messages
-- הרץ זאת אחרי polls_system.sql

-- הוסף עמודה עבור poll_id
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS poll_id UUID REFERENCES public.polls(id) ON DELETE SET NULL;

-- צור index לביצועים
CREATE INDEX IF NOT EXISTS idx_messages_poll_id ON public.messages(poll_id);

-- בדיקה שהעמודה נוספה
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'poll_id'
  ) THEN
    RAISE NOTICE '✅ עמודת poll_id נוספה בהצלחה לטבלת messages!';
  ELSE
    RAISE EXCEPTION '❌ כשלון בהוספת עמודת poll_id';
  END IF;
END $$;

