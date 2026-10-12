-- סריקת אבטחה 2026-10-12: payment_transactions היה פתוח לכתיבה (insert_any_transaction עם true,
-- update_own_or_pending על כל הזמנה ממתינה, ו-UPDATE גם ל-anon) — אפשר היה להחליף plan_id לפני תשלום.
-- האפליקציה רק קוראת את ההזמנות של המשתמש; כתיבה רק מהשרת (service role). נבדק אחרי ההחלה.
drop policy if exists "insert_any_transaction" on public.payment_transactions;
drop policy if exists "update_own_or_pending" on public.payment_transactions;
drop policy if exists "Users can insert their own payment transactions or pending tran" on public.payment_transactions;
drop policy if exists "Users can update pending payment transactions" on public.payment_transactions;
revoke insert, update, delete on public.payment_transactions from anon, authenticated;
