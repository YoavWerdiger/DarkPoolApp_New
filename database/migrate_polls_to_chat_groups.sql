-- ============================================
-- Migration: עדכון טבלת polls למערכת chat_groups
-- ============================================
-- משנה את foreign key constraint מ-channels ל-chat_groups
-- ============================================

-- שלב 1: הסרת ה-foreign key constraint הישן
ALTER TABLE public.polls 
DROP CONSTRAINT IF EXISTS polls_chat_id_fkey;

-- שלב 1.5: תיקון נתונים קיימים
-- אם יש רשומות ב-polls שמצביעות ל-chat_id שלא קיים ב-chat_groups,
-- אי אפשר להוסיף FK חדש. ניצור placeholder groups עבור כל chat_id חסר.
-- created_by הוא UUID, ולכן או שמדלגים עליו או שמכניסים NULL::uuid
INSERT INTO public.chat_groups (id, name)
SELECT DISTINCT
  p.chat_id,
  'קבוצה (מיגרציה - לא בשימוש)'
FROM public.polls p
LEFT JOIN public.chat_groups g ON g.id = p.chat_id
WHERE g.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- שלב 2: הוספת foreign key constraint חדש ל-chat_groups
ALTER TABLE public.polls 
ADD CONSTRAINT polls_chat_id_fkey 
FOREIGN KEY (chat_id) 
REFERENCES public.chat_groups(id) 
ON DELETE CASCADE;

-- הערה: השדה chat_id נשאר עם אותו שם, אבל עכשיו הוא מתייחס ל-chat_groups
-- אם יש נתונים קיימים בטבלת polls שמתייחסים ל-channels, הם יישארו
-- אבל לא ניתן יהיה ליצור סקרים חדשים עם chat_id שלא קיים ב-chat_groups




