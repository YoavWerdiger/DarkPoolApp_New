-- פונקציות למסד נתונים של חדשות
-- ===================================

-- פונקציה לעדכון מספר צפיות
CREATE OR REPLACE FUNCTION increment_news_view_count(article_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE app_news 
  SET view_count = COALESCE(view_count, 0) + 1,
      updated_at = NOW()
  WHERE id = article_id;
END;
$$ LANGUAGE plpgsql;

-- פונקציה לקבלת חדשות מומלצות
CREATE OR REPLACE FUNCTION get_featured_news(limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  summary TEXT,
  source TEXT,
  source_url TEXT,
  author TEXT,
  image_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  category TEXT,
  tags TEXT[],
  is_featured BOOLEAN,
  view_count INTEGER,
  sentiment TEXT,
  relevance_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    an.id,
    an.title,
    an.content,
    an.summary,
    an.source,
    an.source_url,
    an.author,
    an.image_url,
    an.published_at,
    an.created_at,
    an.updated_at,
    an.category,
    an.tags,
    an.is_featured,
    an.view_count,
    an.sentiment,
    an.relevance_score
  FROM app_news an
  WHERE an.is_featured = true
  ORDER BY an.published_at DESC, an.relevance_score DESC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- פונקציה לחיפוש חדשות
CREATE OR REPLACE FUNCTION search_news(
  search_query TEXT,
  category_filter TEXT DEFAULT NULL,
  source_filter TEXT DEFAULT NULL,
  date_from TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  date_to TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  summary TEXT,
  source TEXT,
  source_url TEXT,
  author TEXT,
  image_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  category TEXT,
  tags TEXT[],
  is_featured BOOLEAN,
  view_count INTEGER,
  sentiment TEXT,
  relevance_score NUMERIC,
  search_rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    an.id,
    an.title,
    an.content,
    an.summary,
    an.source,
    an.source_url,
    an.author,
    an.image_url,
    an.published_at,
    an.created_at,
    an.updated_at,
    an.category,
    an.tags,
    an.is_featured,
    an.view_count,
    an.sentiment,
    an.relevance_score,
    ts_rank(
      to_tsvector('english', COALESCE(an.title, '') || ' ' || COALESCE(an.summary, '') || ' ' || COALESCE(an.content, '')),
      plainto_tsquery('english', search_query)
    ) as search_rank
  FROM app_news an
  WHERE (
    an.title ILIKE '%' || search_query || '%' OR
    an.summary ILIKE '%' || search_query || '%' OR
    an.content ILIKE '%' || search_query || '%' OR
    to_tsvector('english', COALESCE(an.title, '') || ' ' || COALESCE(an.summary, '') || ' ' || COALESCE(an.content, ''))
    @@ plainto_tsquery('english', search_query)
  )
  AND (category_filter IS NULL OR an.category = category_filter)
  AND (source_filter IS NULL OR an.source = source_filter)
  AND (date_from IS NULL OR an.published_at >= date_from)
  AND (date_to IS NULL OR an.published_at <= date_to)
  ORDER BY 
    CASE WHEN an.is_featured THEN 1 ELSE 2 END,
    search_rank DESC,
    an.published_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- פונקציה לקבלת סטטיסטיקות חדשות
CREATE OR REPLACE FUNCTION get_news_stats()
RETURNS TABLE (
  total_articles BIGINT,
  featured_articles BIGINT,
  categories_count BIGINT,
  sources_count BIGINT,
  latest_article_date TIMESTAMP WITH TIME ZONE,
  total_views BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_articles,
    COUNT(*) FILTER (WHERE is_featured = true) as featured_articles,
    COUNT(DISTINCT category) as categories_count,
    COUNT(DISTINCT source) as sources_count,
    MAX(published_at) as latest_article_date,
    SUM(COALESCE(view_count, 0)) as total_views
  FROM app_news;
END;
$$ LANGUAGE plpgsql;

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_app_news_published_at ON app_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_news_category ON app_news(category);
CREATE INDEX IF NOT EXISTS idx_app_news_source ON app_news(source);
CREATE INDEX IF NOT EXISTS idx_app_news_featured ON app_news(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_app_news_sentiment ON app_news(sentiment);
CREATE INDEX IF NOT EXISTS idx_app_news_relevance ON app_news(relevance_score DESC NULLS LAST);

-- אינדקס טקסט מלא לחיפוש
CREATE INDEX IF NOT EXISTS idx_app_news_search 
ON app_news USING gin(
  to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(summary, '') || ' ' || COALESCE(content, ''))
);

-- טריגר לעדכון updated_at
CREATE OR REPLACE FUNCTION update_news_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_news_updated_at
  BEFORE UPDATE ON app_news
  FOR EACH ROW
  EXECUTE FUNCTION update_news_updated_at();

-- RLS policies (אם נדרש)
-- ALTER TABLE app_news ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Anyone can view news" ON app_news
--   FOR SELECT USING (true);

-- CREATE POLICY "Only authenticated users can insert news" ON app_news
--   FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- CREATE POLICY "Only authenticated users can update news" ON app_news
--   FOR UPDATE USING (auth.role() = 'authenticated');

-- CREATE POLICY "Only authenticated users can delete news" ON app_news
--   FOR DELETE USING (auth.role() = 'authenticated');
