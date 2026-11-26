-- יצירת טבלת Economic Events
-- לטבלה זו נשמור את כל האירועים הכלכליים מ-FRED API

-- מחיקת הטבלה אם קיימת
DROP TABLE IF EXISTS economic_events;

-- יצירת הטבלה
CREATE TABLE economic_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  country TEXT NOT NULL,
  currency TEXT NOT NULL,
  importance TEXT NOT NULL CHECK (importance IN ('high', 'medium', 'low')),
  date DATE NOT NULL,
  time TEXT,
  actual TEXT,
  forecast TEXT,
  previous TEXT,
  description TEXT,
  category TEXT,
  impact TEXT,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- יצירת אינדקסים לביצועים טובים יותר
CREATE INDEX idx_economic_events_date ON economic_events(date);
CREATE INDEX idx_economic_events_importance ON economic_events(importance);
CREATE INDEX idx_economic_events_category ON economic_events(category);
CREATE INDEX idx_economic_events_country ON economic_events(country);

-- הפעלת RLS (Row Level Security)
ALTER TABLE economic_events ENABLE ROW LEVEL SECURITY;

-- מדיניות RLS - כל המשתמשים יכולים לקרוא
CREATE POLICY "Economic events are viewable by everyone" ON economic_events
  FOR SELECT USING (true);

-- מדיניות RLS - רק שירות יכול לכתוב
CREATE POLICY "Economic events are insertable by service" ON economic_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Economic events are updatable by service" ON economic_events
  FOR UPDATE USING (true);

CREATE POLICY "Economic events are deletable by service" ON economic_events
  FOR DELETE USING (true);

-- הפעלת Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE economic_events;

-- הוספת טריגר לעדכון updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_economic_events_updated_at 
  BEFORE UPDATE ON economic_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- הוספת הערות לטבלה
COMMENT ON TABLE economic_events IS 'Economic events from FRED API and other sources';
COMMENT ON COLUMN economic_events.id IS 'Unique identifier for the event';
COMMENT ON COLUMN economic_events.title IS 'Event title in Hebrew';
COMMENT ON COLUMN economic_events.importance IS 'Event importance: high, medium, low';
COMMENT ON COLUMN economic_events.date IS 'Event date';
COMMENT ON COLUMN economic_events.actual IS 'Actual value (if available)';
COMMENT ON COLUMN economic_events.forecast IS 'Forecasted value (if available)';
COMMENT ON COLUMN economic_events.previous IS 'Previous value (if available)';
COMMENT ON COLUMN economic_events.category IS 'Event category (e.g., inflation, employment)';
COMMENT ON COLUMN economic_events.source IS 'Data source (e.g., FRED, EODHD)';