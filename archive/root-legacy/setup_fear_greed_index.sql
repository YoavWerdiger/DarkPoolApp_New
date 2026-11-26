-- ====================================
-- הגדרת מדד הפחד והתאווה (Fear and Greed Index)
-- ====================================
-- הרץ קובץ זה ב-SQL Editor של Supabase

-- 1. יצירת טבלה למדד
CREATE TABLE IF NOT EXISTS fear_and_greed_index (
  id INTEGER PRIMARY KEY DEFAULT 1,
  value INTEGER NOT NULL CHECK (value >= 0 AND value <= 100),
  value_classification TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  raw_data JSONB,
  CONSTRAINT single_row CHECK (id = 1)
);

-- 2. יצירת index לעדכונים מהירים
CREATE INDEX IF NOT EXISTS idx_fear_greed_updated_at ON fear_and_greed_index(updated_at);

-- 3. RLS Policy - כל אחד יכול לקרוא
ALTER TABLE fear_and_greed_index ENABLE ROW LEVEL SECURITY;

-- מחיקת Policies ישנים (אם קיימים)
DROP POLICY IF EXISTS "Anyone can read fear and greed index" ON fear_and_greed_index;
DROP POLICY IF EXISTS "Service role can update fear and greed index" ON fear_and_greed_index;

-- Policy לקריאה - כל אחד יכול לקרוא
CREATE POLICY "Anyone can read fear and greed index"
  ON fear_and_greed_index
  FOR SELECT
  USING (true);

-- Policy לעדכון - רק service role יכול לעדכן
CREATE POLICY "Service role can update fear and greed index"
  ON fear_and_greed_index
  FOR ALL
  USING (auth.role() = 'service_role');

-- הודעת הצלחה
DO $$
BEGIN
  RAISE NOTICE '✅ טבלת fear_and_greed_index נוצרה בהצלחה!';
  RAISE NOTICE '📊 הטבלה מוכנה לקבל נתונים מה-Edge Function';
END $$;


