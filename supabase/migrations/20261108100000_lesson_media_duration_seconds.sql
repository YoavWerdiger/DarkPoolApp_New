-- אורך השיעור בשניות (לתצוגת «שיעור N · 12:34») — עד עכשיו נשמרו רק דקות שלמות (duration_minutes integer).
alter table public.lesson_media_links add column if not exists duration_seconds integer;

-- מילוי ראשוני מהאורך האמיתי שהנגן כבר רשם אצל משתמשים שצפו (המקסימום לכל שיעור)
update public.lesson_media_links m
set duration_seconds = p.max_seconds
from (
  select course_id, lesson_id, max(total_duration_seconds)::integer as max_seconds
  from public.user_course_progress
  where total_duration_seconds > 0
  group by course_id, lesson_id
) p
where m.course_id = p.course_id
  and m.lesson_id = p.lesson_id
  and m.duration_seconds is null;
