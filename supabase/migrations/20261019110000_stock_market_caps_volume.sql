-- נפח מסחר: last_volume = נפח היום מה-screener; avg_volume = ממוצע נע (EMA) שמתעדכן כל לילה — לסינון לוח הדוחות
alter table public.stock_market_caps add column if not exists last_volume numeric;
alter table public.stock_market_caps add column if not exists avg_volume numeric;
