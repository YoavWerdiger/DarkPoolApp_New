-- Onboarding questionnaire (intake) lives in public.users.intro_data (JSONB).
-- Canonical keys written by RegistrationIntroScreen / RegistrationSummaryScreen:
--   age               number — numeric age (16-100), preferred over age_range
--   age_range         text   — under_18 | 18_24 | 25_34 | 35_44 | 45_54 | 55_plus (deprecated, legacy)
--   experience_level  text   — first_steps | beginner | intermediate | advanced
--   trading_focus     text   — day_trading | swing | long_term
--   trading_platform  text   — bank | interactive_brokers | tradestation | colmex | other
--   portfolio_size    text   — under_10k | 10k_50k | 50k_100k | over_100k  (optional)
-- Values are English snake_case; Hebrew labels are UI-only.

COMMENT ON COLUMN public.users.intro_data IS
  'Registration/onboarding questionnaire JSON. Keys: age (number, preferred) OR age_range (legacy text), experience_level, trading_focus, trading_platform, portfolio_size (optional). Stable English snake_case values.';
