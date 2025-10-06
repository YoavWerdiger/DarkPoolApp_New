-- יצירת טבלת אירועים כלכליים
CREATE TABLE IF NOT EXISTS economic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) UNIQUE NOT NULL, -- מזהה ייחודי מהמקור (FRED/EODHD)
  title TEXT NOT NULL,
  description TEXT,
  country VARCHAR(10) NOT NULL DEFAULT 'US',
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  importance VARCHAR(10) NOT NULL CHECK (importance IN ('high', 'medium', 'low')),
  event_d   ate DATE NOT NULL,
  event_time TIME,
  actual_value TEXT,
  forecast_value TEXT,
  previous_value TEXT,
  category VARCHAR(100),
  source VARCHAR(50) NOT NULL, -- 'FRED', 'EODHD', 'TRADING_ECONOMICS'
  event_type VARCHAR(100), -- סוג האירוע (CPI, NFP, וכו')
  period VARCHAR(50), -- תקופה (Q1 2024, Aug 2024, וכו')
  comparison_type VARCHAR(10), -- yoy, qoq, mom
  unit VARCHAR(50), -- יחידת מדידה
  value_number DECIMAL(15,4), -- ערך מספרי למיון
  is_historical BOOLEAN DEFAULT false, -- האם זה נתון היסטורי
  is_upcoming BOOLEAN DEFAULT true, -- האם זה אירוע עתידי
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_economic_events_date ON economic_events(event_date);
CREATE INDEX IF NOT EXISTS idx_economic_events_country ON economic_events(country);
CREATE INDEX IF NOT EXISTS idx_economic_events_importance ON economic_events(importance);
CREATE INDEX IF NOT EXISTS idx_economic_events_source ON economic_events(source);
CREATE INDEX IF NOT EXISTS idx_economic_events_type ON economic_events(event_type);
CREATE INDEX IF NOT EXISTS idx_economic_events_historical ON economic_events(is_historical);
CREATE INDEX IF NOT EXISTS idx_economic_events_upcoming ON economic_events(is_upcoming);
CREATE INDEX IF NOT EXISTS idx_economic_events_event_id ON economic_events(event_id);

-- אינדקס מורכב לחיפושים נפוצים
CREATE INDEX IF NOT EXISTS idx_economic_events_date_importance ON economic_events(event_date, importance);
CREATE INDEX IF NOT EXISTS idx_economic_events_country_date ON economic_events(country, event_date);

-- טבלת cache metadata
CREATE TABLE IF NOT EXISTS economic_data_cache_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(100) UNIQUE NOT NULL, -- מפתח cache (למשל: 'US_high_2024-01')
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_update TIMESTAMP WITH TIME ZONE NOT NULL,
  total_events INTEGER DEFAULT 0,
  source VARCHAR(50) NOT NULL,
  country VARCHAR(10) NOT NULL,
  importance VARCHAR(10),
  date_range_start DATE,
  date_range_end DATE,
  is_active BOOLEAN DEFAULT true,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- אינדקסים ל-cache metadata
CREATE INDEX IF NOT EXISTS idx_cache_meta_key ON economic_data_cache_meta(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_meta_next_update ON economic_data_cache_meta(next_update);
CREATE INDEX IF NOT EXISTS idx_cache_meta_active ON economic_data_cache_meta(is_active);

-- טבלת webhook events לעדכונים בזמן אמת
CREATE TABLE IF NOT EXISTS economic_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL, -- 'NEW_EVENT', 'UPDATED_EVENT', 'CACHE_REFRESHED'
  event_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- אינדקסים ל-webhook events
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON economic_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON economic_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON economic_webhook_events(created_at);

-- פונקציה לעדכון updated_at
CREATE OR REPLACE FUNCTION update_economic_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- טריגר לעדכון updated_at
CREATE TRIGGER trigger_update_economic_events_updated_at
  BEFORE UPDATE ON economic_events
  FOR EACH ROW
  EXECUTE FUNCTION update_economic_events_updated_at();

-- פונקציה לניקוי נתונים ישנים (יותר מ-6 חודשים)
CREATE OR REPLACE FUNCTION cleanup_old_economic_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM economic_events 
  WHERE event_date < CURRENT_DATE - INTERVAL '6 months'
    AND is_historical = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- ניקוי cache metadata ישן
  DELETE FROM economic_data_cache_meta 
  WHERE last_updated < CURRENT_DATE - INTERVAL '1 month';
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- פונקציה לקבלת אירועים לפי תאריך
CREATE OR REPLACE FUNCTION get_economic_events_by_date(
  target_date DATE,
  target_country VARCHAR(10) DEFAULT 'US',
  target_importance VARCHAR(10) DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  country VARCHAR(10),
  currency VARCHAR(10),
  importance VARCHAR(10),
  event_date DATE,
  event_time TIME,
  actual_value TEXT,
  forecast_value TEXT,
  previous_value TEXT,
  category VARCHAR(100),
  source VARCHAR(50),
  event_type VARCHAR(100),
  period VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.description,
    e.country,
    e.currency,
    e.importance,
    e.event_date,
    e.event_time,
    e.actual_value,
    e.forecast_value,
    e.previous_value,
    e.category,
    e.source,
    e.event_type,
    e.period
  FROM economic_events e
  WHERE e.event_date = target_date
    AND e.country = target_country
    AND (target_importance IS NULL OR e.importance = target_importance)
  ORDER BY e.event_time ASC NULLS LAST, e.importance DESC;
END;
$$ LANGUAGE plpgsql;

-- פונקציה לקבלת אירועים עתידיים
CREATE OR REPLACE FUNCTION get_upcoming_economic_events(
  days_ahead INTEGER DEFAULT 30,
  target_country VARCHAR(10) DEFAULT 'US',
  target_importance VARCHAR(10) DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  country VARCHAR(10),
  currency VARCHAR(10),
  importance VARCHAR(10),
  event_date DATE,
  event_time TIME,
  actual_value TEXT,
  forecast_value TEXT,
  previous_value TEXT,
  category VARCHAR(100),
  source VARCHAR(50),
  event_type VARCHAR(100),
  period VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.description,
    e.country,
    e.currency,
    e.importance,
    e.event_date,
    e.event_time,
    e.actual_value,
    e.forecast_value,
    e.previous_value,
    e.category,
    e.source,
    e.event_type,
    e.period
  FROM economic_events e
  WHERE e.event_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 day' * days_ahead
    AND e.country = target_country
    AND e.is_upcoming = true
    AND (target_importance IS NULL OR e.importance = target_importance)
  ORDER BY e.event_date ASC, e.event_time ASC NULLS LAST, e.importance DESC;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE economic_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_data_cache_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_webhook_events ENABLE ROW LEVEL SECURITY;

-- Policy: כל המשתמשים יכולים לקרוא נתונים כלכליים
CREATE POLICY "Allow read access to economic events" ON economic_events
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to cache metadata" ON economic_data_cache_meta
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to webhook events" ON economic_webhook_events
  FOR SELECT USING (true);

-- Policy: רק משתמשים מורשים יכולים לעדכן נתונים
CREATE POLICY "Allow insert/update economic events for authenticated users" ON economic_events
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert/update cache metadata for authenticated users" ON economic_data_cache_meta
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert/update webhook events for authenticated users" ON economic_webhook_events
  FOR ALL USING (auth.role() = 'authenticated');

-- הוספת הערות לטבלאות
COMMENT ON TABLE economic_events IS 'טבלת אירועים כלכליים - נשמרת במסד הנתונים עם cache חכם';
COMMENT ON TABLE economic_data_cache_meta IS 'מטא-דאטה של cache - מתי עדכנו לאחרונה, מתי לעדכן הבא';
COMMENT ON TABLE economic_webhook_events IS 'אירועי webhook לעדכונים בזמן אמת';

-- הוספת נתונים לדוגמה (אופציונלי)
-- INSERT INTO economic_events (event_id, title, country, importance, event_date, event_time, source, event_type, is_upcoming)
-- VALUES 
--   ('fred_cpi_2024-01-15', 'CPI - Consumer Price Index', 'US', 'high', '2024-01-15', '13:30:00', 'FRED', 'CPI', true),
--   ('fred_nfp_2024-02-02', 'NFP - Non-Farm Payrolls', 'US', 'high', '2024-02-02', '13:30:00', 'FRED', 'NFP', true);


  