-- טבלת טריידים - מערכת מסחר
-- =========================================

-- יצירת טבלת trades
CREATE TABLE IF NOT EXISTS public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- פרטי הטרייד
  symbol TEXT NOT NULL, -- סמל המניה/נכס (AAPL, TSLA, וכו')
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')), -- כיוון הטרייד
  entry_price DECIMAL(15, 4) NOT NULL, -- מחיר כניסה
  exit_price DECIMAL(15, 4) NOT NULL, -- מחיר יציאה
  quantity DECIMAL(15, 4) NOT NULL DEFAULT 1, -- כמות (מספר מניות/לוטים)
  
  -- תאריכים
  entry_date TIMESTAMP WITH TIME ZONE NOT NULL, -- תאריך ושעה של כניסה
  exit_date TIMESTAMP WITH TIME ZONE NOT NULL, -- תאריך ושעה של יציאה
  
  -- חישוב P&L
  pnl DECIMAL(15, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN direction = 'long' THEN (exit_price - entry_price) * quantity
      WHEN direction = 'short' THEN (entry_price - exit_price) * quantity
      ELSE 0
    END
  ) STORED, -- P&L מחושב אוטומטית
  
  -- חישוב תשואה (ROI) באחוזים
  return_percentage DECIMAL(10, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN entry_price > 0 THEN
        CASE 
          WHEN direction = 'long' THEN ((exit_price - entry_price) / entry_price) * 100
          WHEN direction = 'short' THEN ((entry_price - exit_price) / entry_price) * 100
          ELSE 0
        END
      ELSE 0
    END
  ) STORED, -- תשואה באחוזים מחושבת אוטומטית
  
  -- הערות ותגיות
  notes TEXT, -- הערות על הטרייד
  tags TEXT[], -- תגיות (אופציונלי)
  
  -- מטא-דאטה
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON public.trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_entry_date ON public.trades(entry_date);
CREATE INDEX IF NOT EXISTS idx_trades_exit_date ON public.trades(exit_date);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON public.trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_user_entry_date ON public.trades(user_id, entry_date);

-- טריגר לעדכון updated_at
CREATE OR REPLACE FUNCTION update_trades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trades_updated_at_trigger
  BEFORE UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION update_trades_updated_at();

-- RLS Policies - כל משתמש רואה רק את הטריידים שלו
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Policy: משתמשים יכולים לראות רק את הטריידים שלהם
CREATE POLICY "Users can view their own trades"
  ON public.trades
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: משתמשים יכולים להוסיף טריידים רק לעצמם
CREATE POLICY "Users can insert their own trades"
  ON public.trades
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: משתמשים יכולים לעדכן רק את הטריידים שלהם
CREATE POLICY "Users can update their own trades"
  ON public.trades
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: משתמשים יכולים למחוק רק את הטריידים שלהם
CREATE POLICY "Users can delete their own trades"
  ON public.trades
  FOR DELETE
  USING (auth.uid() = user_id);

-- פונקציה לחישוב P&L יומי
CREATE OR REPLACE FUNCTION get_daily_pnl(
  p_user_id UUID,
  p_date DATE
)
RETURNS DECIMAL(15, 2) AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT SUM(pnl)
      FROM public.trades
      WHERE user_id = p_user_id
        AND DATE(exit_date) = p_date
    ),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- פונקציה לקבלת P&L לכל יום בחודש
CREATE OR REPLACE FUNCTION get_monthly_pnl(
  p_user_id UUID,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS TABLE (
  date DATE,
  pnl DECIMAL(15, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(t.exit_date) as date,
    SUM(t.pnl) as pnl
  FROM public.trades t
  WHERE t.user_id = p_user_id
    AND EXTRACT(YEAR FROM t.exit_date) = p_year
    AND EXTRACT(MONTH FROM t.exit_date) = p_month
  GROUP BY DATE(t.exit_date)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

