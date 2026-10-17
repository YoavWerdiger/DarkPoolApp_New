-- מקור כל שורת 13F: 'sec' (ישירות מ-EDGAR) או null (Quiver). כשיש לתקופה שורות sec — הקוראים מתעלמים משורות Quiver
-- של אותה תקופה (טיקרים ישנים, ושורות שגויות כמו Berkshire 2022-09-30 ‏$879B) — בלי למחוק.
alter table public.dark_pool_fund_holdings add column if not exists source text;
