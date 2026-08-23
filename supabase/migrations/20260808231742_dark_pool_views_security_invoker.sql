-- Make the two dark pool views honour the gating their base tables already declare.
--
-- 018_dark_pool.sql granted these views to `authenticated` only, and
-- dark_pool_trades / dark_pool_daily_aggregates both restrict SELECT to the
-- authenticated role. Because the views are SECURITY DEFINER they ran as the
-- owner instead, and the packaged anon key could read 12 whale prints and 3353
-- accumulation rows without logging in.
--
-- Both are read through darkPoolService with a signed-in session, and the
-- authenticated policies on the base tables are USING (true), so switching to
-- security_invoker changes nothing for real users. Premium gating stays where it
-- already lives, in listWhaleOrders / listTopAccumulation.

alter view public.v_dark_pool_recent_whales set (security_invoker = true);
alter view public.v_dark_pool_top_accumulation_3d set (security_invoker = true);
