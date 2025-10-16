-- הוספת עמודת label לטבלת app_news
-- =====================================

-- הוספת העמודה החדשה
ALTER TABLE public.app_news 
ADD COLUMN IF NOT EXISTS label TEXT;

-- יצירת אינדקס על העמודה לביצועים טובים יותר
CREATE INDEX IF NOT EXISTS idx_app_news_label 
ON public.app_news(label);

-- בדיקה שהעמודה נוספה בהצלחה
SELECT 
  '✅ עמודת label נוספה בהצלחה' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'app_news'
  AND column_name = 'label';

-- הצגת מבנה הטבלה המעודכן
SELECT 
  '📋 מבנה הטבלה המלא' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'app_news'
ORDER BY ordinal_position;


