-- Berkshire Hathaway = Warren Buffett's portfolio: show it with the investors
-- (funds), not under public companies.
update public.dark_pool_fund_managers
   set entity_type = 'fund',
       manager_name = 'Warren Buffett'
 where cik = '1067983';
