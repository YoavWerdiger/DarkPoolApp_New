-- סריקת אבטחה 2026-10-12: עם המפתח הציבורי (anon) בלבד היה אפשר למחוק את כל 3,620 האירועים הכלכליים
-- ואת כל 2,684 החדשות (נבדק בטרנזקציה מבוטלת).
-- economic_events: כל הכותבים הם Edge Functions עם service role (עוקף RLS); האפליקציה רק קוראת.
drop policy if exists "Economic events are insertable by service" on public.economic_events;
drop policy if exists "Economic events are updatable by service" on public.economic_events;
drop policy if exists "Economic events are deletable by service" on public.economic_events;

-- app_news_clean: «Enable all access» ל-anon ול-authenticated עקף את מדיניות האדמין הקיימת.
-- נשארו: קריאה למחוברים, הוספה/עריכה/מחיקה לאדמין. anon: קריאה והוספה (מקור חדשות חיצוני אפשרי) — בלי עריכה/מחיקה.
drop policy if exists "Enable all access for authenticated users" on public.app_news_clean;
drop policy if exists "Enable all access for anon users" on public.app_news_clean;
create policy app_news_clean_anon_read on public.app_news_clean for select to anon using (true);
create policy app_news_clean_anon_insert on public.app_news_clean for insert to anon with check (true);
-- נבדק אחרי: anon מחיקה/עריכה 0, קריאה מלאה; משתמש רגיל קריאה מלאה, מחיקה 0, הוספה חסומה.
