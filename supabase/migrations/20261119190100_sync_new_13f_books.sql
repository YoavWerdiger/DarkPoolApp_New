-- Pull the new 13F books to production (SEC). Run ONE line at a time,
-- ~1 minute apart (parallel runs hit OpenFIGI 429).
-- Requires: npx supabase functions deploy sync-fund-13f-sec

select public.sync_13f_ciks(array['1079114'], 4);            -- David Einhorn / Greenlight
select public.sync_13f_ciks(array['1108524', '804328'], 4);  -- Salesforce, Qualcomm
select public.sync_13f_ciks(array['59478'], 4);              -- Eli Lilly
select public.sync_13f_ciks(array['1096343', '60086'], 4);   -- Markel, Loews
select public.sync_13f_ciks(array['915191'], 4);             -- Fairfax
select public.sync_13f_ciks(array['896159', '80661'], 4);    -- Chubb, Progressive
select public.sync_13f_ciks(array['20286', '11544'], 4);     -- Cincinnati Financial, W. R. Berkley
select public.sync_13f_ciks(array['1042046'], 4);            -- American Financial
