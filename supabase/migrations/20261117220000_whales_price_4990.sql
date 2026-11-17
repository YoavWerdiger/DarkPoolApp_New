-- Whales course price: 4990 ILS (server is the source of truth for the charge).
update public.courses
   set price = 4990
 where id = 'whales-course-1';

update public.subscription_plans
   set price = 4990,
       updated_at = now()
 where id = 'course:whales-course-1';
