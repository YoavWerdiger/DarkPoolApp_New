-- migration: add_colmex_position_id_to_trades
-- --------------------------------------------------------------------------
-- מוסיף את העמודות colmex_position_id ו-source לטבלת trades.
--
-- colmex_position_id: מזהה ייחודי של הפוזיציה אצל Colmex (position_id מה-API).
--   מאפשר מניעת כפילויות ו-idempotent upsert בעת סנכרון.
--
-- source: מקור העסקה — 'manual' (ברירת מחדל) | 'colmex_pro' | 'import' וכו'.
--   מאפשר סינון "תיק מחובר לברוקר" לעומת "תיק ידני".
-- --------------------------------------------------------------------------

ALTER TABLE trades ADD COLUMN IF NOT EXISTS colmex_position_id TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- unique index: כל position_id של Colmex מופיע פעם אחת בלבד
CREATE UNIQUE INDEX IF NOT EXISTS trades_colmex_position_id_idx
  ON trades(colmex_position_id) WHERE colmex_position_id IS NOT NULL;

-- index על source לשאילתות מסוג "תיקים מחוברים"
CREATE INDEX IF NOT EXISTS trades_source_idx ON trades(source);

COMMENT ON COLUMN trades.colmex_position_id IS
  'Identifier of the position in Colmex TradeRevolution (position_id from GET /accounts/{id}/positions). Used for idempotent upsert during broker sync.';

COMMENT ON COLUMN trades.source IS
  'Origin of the trade: ''manual'' (default), ''colmex_pro'', ''import'', etc.';
