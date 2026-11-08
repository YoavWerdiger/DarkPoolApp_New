-- QA 5.2: שינוי הצבעה בלחיצה אחת, כמו בוואטסאפ.
-- ממשק יצירת הסקר מעולם לא הציע את האפשרות — כל ה-false הקיימים הם ברירת המחדל, לא בחירה של היוצר.
ALTER TABLE public.polls ALTER COLUMN allow_vote_change SET DEFAULT TRUE;

UPDATE public.polls
SET allow_vote_change = TRUE
WHERE allow_vote_change = FALSE;
