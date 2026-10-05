-- אלבום מדיה: כמה הודעות תמונה/וידאו שנשלחו יחד חולקות media_group_id (תצוגת גריד כמו וואטסאפ)
alter table public.chat_messages add column if not exists media_group_id uuid;
-- הקליינט כבר שולח client_message_id (לדה-דופ אופטימי); בלי העמודה כל שליחה נכשלה ונוסתה שוב
alter table public.chat_messages add column if not exists client_message_id text;
create index if not exists chat_messages_media_group_id_idx on public.chat_messages (media_group_id) where media_group_id is not null;
