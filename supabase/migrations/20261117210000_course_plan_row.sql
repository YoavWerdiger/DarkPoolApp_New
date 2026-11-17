-- payment_transactions.plan_id has an FK to subscription_plans.
-- A course purchase uses plan_id 'course:<id>', so it needs a row there.
-- active = false: never offered or activated as a subscription
-- (create-payment rejects inactive plans for subscriptions;
--  course purchases take the price from courses.price).

insert into public.subscription_plans
  (id, name, description, price, period, role, popular, active)
values
  ('course:whales-course-1', 'קורס הלוויתנים', 'רכישה חד-פעמית',
   531, 'one_time', 'course_purchase', false, false)
on conflict (id) do update
  set price = excluded.price,
      active = false,
      updated_at = now();
