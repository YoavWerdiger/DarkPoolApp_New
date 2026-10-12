-- trades: מדיניות מתירנית (user_id = אני בלבד) ב-OR עם המדיניות ההדוקה — אפשרה להכניס/להעביר עסקה לתיק של משתמש אחר
-- (משבש את התשואה שלו). נשארות trades_owner_insert / trades_owner_update (בודקות שהתיק שלך).
-- נבדק: הכנסה לתיק זר ✗ (לפני: הותר); לתיק שלי ✓; עדכון שלי ✓; העברה לתיק זר ✗ (לפני: הותר); בלי תיק ✓.
drop policy if exists "Users can insert their own trades" on public.trades;
drop policy if exists "Users can update their own trades" on public.trades;
