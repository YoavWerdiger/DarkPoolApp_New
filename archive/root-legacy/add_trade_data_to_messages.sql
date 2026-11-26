-- הוספת עמודת trade_data לטבלת messages
-- =========================================

-- הוספת עמודת trade_data (JSONB) לטבלת messages
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS trade_data JSONB;

-- הערה: עמודת trade_data תשמש לאחסון נתוני טריידים משותפים בצ'אט
-- המבנה של trade_data:
-- {
--   "id": "uuid",
--   "symbol": "AAPL",
--   "direction": "long" | "short",
--   "entry_price": 150.00,
--   "exit_price": 155.00,
--   "quantity": 10,
--   "entry_date": "2024-01-01T09:30:00Z",
--   "exit_date": "2024-01-01T16:00:00Z",
--   "pnl": 50.00,
--   "return_percentage": 3.33,
--   "notes": "הערות על הטרייד",
--   "tags": ["tag1", "tag2"]
-- }


