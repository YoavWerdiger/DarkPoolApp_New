-- יצירת טבלת app_news
-- ======================

-- מחיקת הטבלה אם היא קיימת
DROP TABLE IF EXISTS public.app_news CASCADE;

-- יצירת הטבלה
CREATE TABLE public.app_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  source TEXT NOT NULL,
  source_url TEXT,
  author TEXT,
  image_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  category TEXT,
  tags TEXT[],
  is_featured BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  relevance_score NUMERIC DEFAULT 0
);

-- יצירת אינדקסים לביצועים
CREATE INDEX idx_app_news_created_at ON public.app_news(created_at DESC);
CREATE INDEX idx_app_news_published_at ON public.app_news(published_at DESC);
CREATE INDEX idx_app_news_category ON public.app_news(category);
CREATE INDEX idx_app_news_source ON public.app_news(source);
CREATE INDEX idx_app_news_featured ON public.app_news(is_featured) WHERE is_featured = true;

-- טריגר לעדכון updated_at
CREATE OR REPLACE FUNCTION update_app_news_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_app_news_updated_at
  BEFORE UPDATE ON public.app_news
  FOR EACH ROW
  EXECUTE FUNCTION update_app_news_updated_at();

-- הפעלת RLS (Row Level Security)
ALTER TABLE public.app_news ENABLE ROW LEVEL SECURITY;

-- מדיניות - כל אחד יכול לקרוא חדשות
CREATE POLICY "Anyone can view news" ON public.app_news
  FOR SELECT USING (true);

-- מדיניות - רק משתמשים מאומתים יכולים להוסיף חדשות
CREATE POLICY "Authenticated users can insert news" ON public.app_news
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- מדיניות - רק משתמשים מאומתים יכולים לעדכן חדשות
CREATE POLICY "Authenticated users can update news" ON public.app_news
  FOR UPDATE USING (auth.role() = 'authenticated');

-- מדיניות - רק משתמשים מאומתים יכולים למחוק חדשות
CREATE POLICY "Authenticated users can delete news" ON public.app_news
  FOR DELETE USING (auth.role() = 'authenticated');

-- הכנסת נתונים לדוגמה
INSERT INTO public.app_news (title, content, summary, source, category, is_featured) VALUES
('ביטקוין עולה ב-15% אחרי החלטת ריבית', 
 'המטבע הדיגיטל עלה משמעותית אחרי שהבנק המרכזי הודיע על שמירת ריבית נמוכה. המשקיעים הגיבו בחיוב להחלטה.',
 'ביטקוין זינק ל-45,000$ אחרי החלטת הריבית של הפדרל ריזרב',
 'Twitter', 
 'מטבעות דיגיטליים', 
 true),

('מדד S&P 500 שובר שיא חדש',
 'מדד המניות האמריקאי הגיע לרמה הגבוהה ביותר בהיסטוריה. כל הסקטורים הראו ביצועים חיוביים.',
 'המדד עלה ל-4,850 נקודות במסחר היום',
 'Bloomberg',
 'בורסה',
 false),

('אינפלציה בארה"ב יורדת ל-3.1%',
 'מדד המחירים לצרכן הראה ירידה קלה באינפלציה החודש. זהו השיפור הראשון מזה 6 חודשים.',
 'זהו השיפור הראשון מזה 6 חודשים באינפלציה',
 'Reuters',
 'כלכלה',
 true),

('Apple מכריזה על דור חדש של iPhone',
 'החברה הודיעה על השקת iPhone 16 עם יכולות AI מתקדמות. המחיר יתחיל מ-999$',
 'iPhone 16 מגיע עם AI מתקדם ומחיר נמוך מהצפוי',
 'Apple News',
 'טכנולוגיה',
 false),

('Tesla מדווחת על שיא מכירות רבעוני',
 'החברה מכרה 500,000 רכבים ברבעון האחרון, עלייה של 20% מהרבעון הקודם',
 'Tesla שוברת שיא מכירות עם 500,000 רכבים',
 'Tesla Blog',
 'רכב חשמלי',
 true);

-- פונקציה לעדכון מספר צפיות
CREATE OR REPLACE FUNCTION increment_news_view_count(article_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.app_news 
  SET view_count = COALESCE(view_count, 0) + 1,
      updated_at = NOW()
  WHERE id = article_id;
END;
$$ LANGUAGE plpgsql;

-- הודעת הצלחה
SELECT 'טבלת app_news נוצרה בהצלחה עם ' || COUNT(*) || ' כתבות לדוגמה' as message
FROM public.app_news;
