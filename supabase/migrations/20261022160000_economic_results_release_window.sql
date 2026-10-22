-- יומן כלכלי: תוצאה לא נשלפה בשעת הדיווח — ה-cron רץ כל 15 דק׳ (:00/:15/:30/:45), ובדיווח של 15:30
-- הוא רץ ב-15:30:04, לפני ש-Benzinga פרסמה; הריצה הבאה רק ב-15:45.
-- עכשיו: בדיקה כל דקה, וקריאה ל-Benzinga רק כשיש אירוע שעבר את שעתו ב-45 הדק׳ האחרונות בלי actual
-- (בנוסף לריצה הרגילה כל 15 דק׳). השעות ב-economic_events הן שעון ישראל.

create or replace function public.invoke_benzinga_results_if_due()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due boolean;
begin
  select exists (
    select 1
      from public.economic_events e
     where e.date between current_date - 1 and current_date
       and e.time ~ '^\d{1,2}:\d{2}$'
       and coalesce(e.actual, '') = ''
       and (e.date + e.time::time) at time zone 'Asia/Jerusalem'
           between now() - interval '45 minutes' and now()
  ) into v_due;

  if v_due or extract(minute from now())::int % 15 = 0 then
    return public.invoke_benzinga_update_results_live();
  end if;
  return null;
end;
$$;

revoke all on function public.invoke_benzinga_results_if_due() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'benzinga-update-results-live';
select cron.schedule('benzinga-update-results-live', '* * * * *', $$select public.invoke_benzinga_results_if_due()$$);
