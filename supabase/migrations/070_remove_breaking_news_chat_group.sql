-- Remove official room "חדשות מתפרצות" (id ...007).
-- chat_message_reactions has ON DELETE NO ACTION — clear first.
-- Other dependent tables CASCADE / SET NULL.

DELETE FROM public.chat_message_reactions
WHERE group_id = '00000000-0000-0000-0000-000000000007';

DELETE FROM public.chat_groups
WHERE id = '00000000-0000-0000-0000-000000000007';
