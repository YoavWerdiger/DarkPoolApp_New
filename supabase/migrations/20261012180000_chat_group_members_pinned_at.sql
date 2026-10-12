-- נעיצת קבוצות מועדפות — פר משתמש (שורת החברות שלו). null = לא נעוץ.
-- המשתמש מעדכן רק את השורה שלו (RLS קיים); הטריגר chat_members_guard לא חוסם עמודה זו.
alter table public.chat_group_members add column if not exists pinned_at timestamptz;
