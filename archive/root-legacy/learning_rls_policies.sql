-- RLS Policies for Learning System
-- Enable RLS and create policies for all learning tables

-- Enable RLS on all tables
alter table learning.instructors enable row level security;
alter table learning.courses enable row level security;
alter table learning.modules enable row level security;
alter table learning.lessons enable row level security;
alter table learning.lesson_blocks enable row level security;
alter table learning.quiz_questions enable row level security;
alter table learning.enrollments enable row level security;
alter table learning.lesson_progress enable row level security;
alter table learning.quiz_attempts enable row level security;
alter table learning.course_reviews enable row level security;

-- Instructors policies
create policy "instructors read all" on learning.instructors
for select using (true);

create policy "instructors write own" on learning.instructors
for all using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Courses policies
create policy "courses read published or owner" on learning.courses
for select using (
  published = true 
  or exists (
    select 1 from learning.instructors i 
    where i.id = owner_id and i.user_id = auth.uid()
  )
);

create policy "courses owner write" on learning.courses
for all using (
  exists (
    select 1 from learning.instructors i 
    where i.id = owner_id and i.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from learning.instructors i 
    where i.id = owner_id and i.user_id = auth.uid()
  )
);

-- Modules policies
create policy "modules read published or owner" on learning.modules
for select using (
  exists (
    select 1 from learning.courses c
    join learning.instructors i on i.id = c.owner_id
    where c.id = modules.course_id 
      and (c.published = true or i.user_id = auth.uid())
  )
);

create policy "modules owner write" on learning.modules
for all using (
  exists (
    select 1 from learning.courses c
    join learning.instructors i on i.id = c.owner_id
    where c.id = modules.course_id and i.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from learning.courses c
    join learning.instructors i on i.id = c.owner_id
    where c.id = modules.course_id and i.user_id = auth.uid()
  )
);

-- Lessons policies
create policy "lessons read published or owner" on learning.lessons
for select using (
  exists (
    select 1 from learning.modules m
    join learning.courses c on c.id = m.course_id
    join learning.instructors i on i.id = c.owner_id
    where m.id = lessons.module_id 
      and (c.published = true or i.user_id = auth.uid())
  )
);

create policy "lessons owner write" on learning.lessons
for all using (
  exists (
    select 1 from learning.modules m
    join learning.courses c on c.id = m.course_id
    join learning.instructors i on i.id = c.owner_id
    where m.id = lessons.module_id and i.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from learning.modules m
    join learning.courses c on c.id = m.course_id
    join learning.instructors i on i.id = c.owner_id
    where m.id = lessons.module_id and i.user_id = auth.uid()
  )
);

-- Lesson blocks policies
create policy "lesson_blocks read published or owner" on learning.lesson_blocks
for select using (
  exists (
    select 1 from learning.lessons l
    join learning.modules m on m.id = l.module_id
    join learning.courses c on c.id = m.course_id
    join learning.instructors i on i.id = c.owner_id
    where l.id = lesson_blocks.lesson_id 
      and (c.published = true or i.user_id = auth.uid())
  )
);

create policy "lesson_blocks owner write" on learning.lesson_blocks
for all using (
  exists (
    select 1 from learning.lessons l
    join learning.modules m on m.id = l.module_id
    join learning.courses c on c.id = m.course_id
    join learning.instructors i on i.id = c.owner_id
    where l.id = lesson_blocks.lesson_id and i.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from learning.lessons l
    join learning.modules m on m.id = l.module_id
    join learning.courses c on c.id = m.course_id
    join learning.instructors i on i.id = c.owner_id
    where l.id = lesson_blocks.lesson_id and i.user_id = auth.uid()
  )
);

-- Quiz questions policies
create policy "quiz_questions read published or owner" on learning.quiz_questions
for select using (
  exists (
    select 1 from learning.lesson_blocks b
    join learning.lessons l on l.id = b.lesson_id
    join learning.modules m on m.id = l.module_id
    join learning.courses c on c.id = m.course_id
    join learning.instructors i on i.id = c.owner_id
    where b.id = quiz_questions.block_id 
      and (c.published = true or i.user_id = auth.uid())
  )
);

create policy "quiz_questions owner write" on learning.quiz_questions
for all using (
  exists (
    select 1 from learning.lesson_blocks b
    join learning.lessons l on l.id = b.lesson_id
    join learning.modules m on m.id = l.module_id
    join learning.courses c on c.id = m.course_id
    join learning.instructors i on i.id = c.owner_id
    where b.id = quiz_questions.block_id and i.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from learning.lesson_blocks b
    join learning.lessons l on l.id = b.lesson_id
    join learning.modules m on m.id = l.module_id
    join learning.courses c on c.id = m.course_id
    join learning.instructors i on i.id = c.owner_id
    where b.id = quiz_questions.block_id and i.user_id = auth.uid()
  )
);

-- Enrollments policies
create policy "enrollments read own or owner" on learning.enrollments
for select using (
  user_id = auth.uid() 
  or exists (
    select 1 from learning.courses c 
    join learning.instructors i on i.id = c.owner_id 
    where c.id = enrollments.course_id and i.user_id = auth.uid()
  )
);

create policy "enrollments insert self" on learning.enrollments
for insert with check (user_id = auth.uid());

create policy "enrollments delete self" on learning.enrollments
for delete using (user_id = auth.uid());

-- Lesson progress policies
create policy "lesson_progress self rw" on learning.lesson_progress
for all using (user_id = auth.uid()) 
with check (user_id = auth.uid());

-- Quiz attempts policies
create policy "quiz_attempts self rw" on learning.quiz_attempts
for all using (user_id = auth.uid()) 
with check (user_id = auth.uid());

-- Course reviews policies
create policy "course_reviews read all" on learning.course_reviews
for select using (true);

create policy "course_reviews write own" on learning.course_reviews
for all using (user_id = auth.uid()) 
with check (user_id = auth.uid());

