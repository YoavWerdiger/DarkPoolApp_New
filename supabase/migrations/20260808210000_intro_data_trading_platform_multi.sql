-- trading_platform inside public.users.intro_data became multi-select.
-- intro_data is JSONB, so no type change is required — this migration only
-- refreshes the column documentation and backfills legacy single-string rows
-- into the new array shape so readers can rely on one representation.

UPDATE public.users
SET intro_data = jsonb_set(
  intro_data,
  '{trading_platform}',
  to_jsonb(ARRAY[intro_data->>'trading_platform'])
)
WHERE intro_data ? 'trading_platform'
  AND jsonb_typeof(intro_data->'trading_platform') = 'string'
  AND intro_data->>'trading_platform' <> '';

-- Rows that stored an empty string end up as an empty array.
UPDATE public.users
SET intro_data = jsonb_set(intro_data, '{trading_platform}', '[]'::jsonb)
WHERE intro_data ? 'trading_platform'
  AND jsonb_typeof(intro_data->'trading_platform') = 'string'
  AND intro_data->>'trading_platform' = '';

COMMENT ON COLUMN public.users.intro_data IS
  'Registration/onboarding questionnaire JSON. Keys: age (number, preferred) OR age_range (legacy text), experience_level, trading_focus, trading_platform (text[] — multi-select: bank | interactive_brokers | tradestation | colmex | other), portfolio_size (optional). Stable English snake_case values.';
