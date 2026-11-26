-- יצירת טבלת Earnings Events
-- לטבלה זו נשמור את כל דיווחי הרווחים מ-EODHD API

-- מחיקת הטבלה אם קיימת
DROP TABLE IF EXISTS earnings_events;

-- יצירת הטבלה
CREATE TABLE earnings_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  symbol TEXT NOT NULL,
  report_date DATE NOT NULL,
  date DATE NOT NULL,
  before_after_market TEXT,
  currency TEXT,
  actual DECIMAL(10,4),
  estimate DECIMAL(10,4),
  difference DECIMAL(10,4),
  percent DECIMAL(10,4),
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- יצירת אינדקסים לביצועים טובים יותר
CREATE INDEX idx_earnings_events_report_date ON earnings_events(report_date);
CREATE INDEX idx_earnings_events_symbol ON earnings_events(symbol);
CREATE INDEX idx_earnings_events_company ON earnings_events(company);
CREATE INDEX idx_earnings_events_date ON earnings_events(date);

-- הפעלת RLS (Row Level Security)
ALTER TABLE earnings_events ENABLE ROW LEVEL SECURITY;

-- מדיניות RLS - כל המשתמשים יכולים לקרוא
CREATE POLICY "Earnings events are viewable by everyone" ON earnings_events
  FOR SELECT USING (true);

-- מדיניות RLS - רק שירות יכול לכתוב
CREATE POLICY "Earnings events are insertable by service" ON earnings_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Earnings events are updatable by service" ON earnings_events
  FOR UPDATE USING (true);

CREATE POLICY "Earnings events are deletable by service" ON earnings_events
  FOR DELETE USING (true);

-- הפעלת Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE earnings_events;

-- הוספת טריגר לעדכון updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_earnings_events_updated_at 
  BEFORE UPDATE ON earnings_events 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- הוספת הערות לטבלה
COMMENT ON TABLE earnings_events IS 'Earnings events from EODHD API';
COMMENT ON COLUMN earnings_events.id IS 'Unique identifier for the earnings event';
COMMENT ON COLUMN earnings_events.title IS 'Earnings event title in Hebrew';
COMMENT ON COLUMN earnings_events.company IS 'Company name';
COMMENT ON COLUMN earnings_events.symbol IS 'Stock symbol';
COMMENT ON COLUMN earnings_events.report_date IS 'Earnings report date';
COMMENT ON COLUMN earnings_events.date IS 'Financial period end date';
COMMENT ON COLUMN earnings_events.before_after_market IS 'Before Market or After Market';
COMMENT ON COLUMN earnings_events.actual IS 'Actual earnings per share';
COMMENT ON COLUMN earnings_events.estimate IS 'Estimated earnings per share';
COMMENT ON COLUMN earnings_events.difference IS 'Difference between actual and estimate';
COMMENT ON COLUMN earnings_events.percent IS 'Percentage difference';
COMMENT ON COLUMN earnings_events.source IS 'Data source (EODHD)';

