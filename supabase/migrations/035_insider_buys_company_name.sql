ALTER TABLE public.dark_pool_insider_buys
  ADD COLUMN IF NOT EXISTS company_name TEXT;

COMMENT ON COLUMN public.dark_pool_insider_buys.company_name IS 'שם החברה מ-Form4API (companyName)';
