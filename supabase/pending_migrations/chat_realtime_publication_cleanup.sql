-- ============================================================================
-- להריץ רק אחרי שכל המשתמשים בבילד שמשתמש ב-Broadcast (chat-group:/chat-user:)
-- ומשתמשים בבילדים ישנים כבר לא פעילים.
-- ----------------------------------------------------------------------------
-- הבילדים הישנים מאזינים ב-postgres_changes לטבלאות האלה. אחרי ההסרה הם יפסיקו לקבל
-- עדכונים חיים (הודעות יופיעו רק אחרי רענון). בבילד החדש אין שום תלות בפרסום הזה.
-- ההסרה חוסכת את עיבוד ה-WAL של Realtime על כל הודעה / קריאה / עדכון unread / הקלדה.
-- ============================================================================
alter publication supabase_realtime drop table public.chat_messages;
alter publication supabase_realtime drop table public.chat_message_reads;
alter publication supabase_realtime drop table public.chat_message_reactions;
alter publication supabase_realtime drop table public.chat_typing_indicators;
alter publication supabase_realtime drop table public.chat_group_members;
alter publication supabase_realtime drop table public.chat_groups;
