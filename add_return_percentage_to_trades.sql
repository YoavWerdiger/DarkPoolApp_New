-- הוספת עמודת תשואה לטבלת trades
-- =========================================

-- הוספת עמודת return_percentage
ALTER TABLE public.trades
ADD COLUMN IF NOT EXISTS return_percentage DECIMAL(10, 2) GENERATED ALWAYS AS (
  CASE 
    WHEN entry_price > 0 THEN
      CASE 
        WHEN direction = 'long' THEN ((exit_price - entry_price) / entry_price) * 100
        WHEN direction = 'short' THEN ((entry_price - exit_price) / entry_price) * 100
        ELSE 0
      END
    ELSE 0
  END
) STORED;


