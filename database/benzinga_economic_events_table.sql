-- ============================================
-- טבלה לאירועים כלכליים מ-Benzinga
-- ============================================

-- יצירת הטבלה אם היא לא קיימת
CREATE TABLE IF NOT EXISTS economic_events_cache (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    time TIME,
    country TEXT NOT NULL DEFAULT 'US',
    importance TEXT CHECK (importance IN ('high', 'medium', 'low')) NOT NULL DEFAULT 'medium',
    actual TEXT,
    forecast TEXT,
    previous TEXT,
    period TEXT,
    source TEXT NOT NULL DEFAULT 'Benzinga',
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- אינדקסים לשיפור ביצועים
CREATE INDEX IF NOT EXISTS idx_economic_events_date ON economic_events_cache(date DESC);
CREATE INDEX IF NOT EXISTS idx_economic_events_country ON economic_events_cache(country);
CREATE INDEX IF NOT EXISTS idx_economic_events_importance ON economic_events_cache(importance);
CREATE INDEX IF NOT EXISTS idx_economic_events_source ON economic_events_cache(source);
CREATE INDEX IF NOT EXISTS idx_economic_events_date_country ON economic_events_cache(date DESC, country);

-- טבלת metadata למעקב אחר עדכונים
CREATE TABLE IF NOT EXISTS economic_cache_metadata (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    country TEXT NOT NULL,
    last_update TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_events INTEGER DEFAULT 0,
    date_range_start DATE,
    date_range_end DATE
);

-- הערות על הטבלה
COMMENT ON TABLE economic_events_cache IS 'אירועים כלכליים מ-Benzinga API';
COMMENT ON COLUMN economic_events_cache.id IS 'מזהה ייחודי של האירוע מ-Benzinga';
COMMENT ON COLUMN economic_events_cache.importance IS 'רמת חשיבות: high, medium, low';
COMMENT ON COLUMN economic_events_cache.actual IS 'ערך בפועל שפורסם';
COMMENT ON COLUMN economic_events_cache.forecast IS 'תחזית/קונצנזוס';
COMMENT ON COLUMN economic_events_cache.previous IS 'ערך קודם';

-- פונקציה לעדכון אוטומטי של last_updated
CREATE OR REPLACE FUNCTION update_economic_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- טריגר לעדכון last_updated
DROP TRIGGER IF EXISTS trigger_update_economic_events_updated_at ON economic_events_cache;
CREATE TRIGGER trigger_update_economic_events_updated_at
    BEFORE UPDATE ON economic_events_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_economic_events_updated_at();

-- פונקציה לניקוי אירועים ישנים (מעל שנה)
CREATE OR REPLACE FUNCTION cleanup_old_economic_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM economic_events_cache
        WHERE date < CURRENT_DATE - INTERVAL '1 year'
        RETURNING *
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- RLS (Row Level Security) - אפשר גישת קריאה לכולם
ALTER TABLE economic_events_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON economic_events_cache
    FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated insert/update" ON economic_events_cache
    FOR ALL
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- טבלת metadata
ALTER TABLE economic_cache_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON economic_cache_metadata
    FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated insert/update" ON economic_cache_metadata
    FOR ALL
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- הוספת נתוני דמו לבדיקה (אופציונלי)
-- ניתן למחוק את החלק הזה אחרי הפריסה
INSERT INTO economic_events_cache (id, title, description, date, time, country, importance, source)
VALUES 
    ('demo_1', 'CPI - Consumer Price Index', 'Inflation indicator', CURRENT_DATE + INTERVAL '1 day', '08:30:00', 'US', 'high', 'Benzinga'),
    ('demo_2', 'NFP - Non-Farm Payrolls', 'Employment data', CURRENT_DATE + INTERVAL '3 days', '08:30:00', 'US', 'high', 'Benzinga'),
    ('demo_3', 'FOMC Rate Decision', 'Federal Reserve interest rate decision', CURRENT_DATE + INTERVAL '7 days', '14:00:00', 'US', 'high', 'Benzinga')
ON CONFLICT (id) DO NOTHING;

-- הודעה על הצלחה
DO $$
BEGIN
    RAISE NOTICE '✅ טבלאות יומן כלכלי נוצרו בהצלחה';
    RAISE NOTICE '📊 economic_events_cache - אירועים כלכליים';
    RAISE NOTICE '📊 economic_cache_metadata - metadata';
    RAISE NOTICE '🔧 פונקציות: cleanup_old_economic_events()';
END $$;








