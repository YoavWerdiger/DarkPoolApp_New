-- Storage Policies for Learning System
-- Create buckets and policies for course media and covers

-- Create storage buckets
insert into storage.buckets (id, name, public) values 
  ('course-media', 'course-media', false),
  ('course-covers', 'course-covers', true);

-- Enable RLS on storage.objects
alter table storage.objects enable row level security;

-- Helper function to extract course ID from storage path
create or replace function learning.object_course_id(name text)
returns uuid language sql immutable as $$
  -- path like 'course-media/{courseId}/...' or 'course-covers/{courseId}/...'
  select nullif(split_part(name, '/', 2), '')::uuid;
$$;

-- Helper function to check if user is enrolled in course
create or replace function learning.user_enrolled_in_course(course_uuid uuid, user_uuid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from learning.enrollments e
    where e.user_id = user_uuid and e.course_id = course_uuid
  );
$$;

-- Helper function to check if lesson is preview
create or replace function learning.is_preview_lesson(lesson_uuid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from learning.lessons l
    where l.id = lesson_uuid and l.is_preview = true
  );
$$;

-- READ policy for course-media: enrolled users or preview lessons
create policy "course-media read for enrolled or preview"
on storage.objects for select
to authenticated
using (
  bucket_id = 'course-media'
  and (
    learning.user_enrolled_in_course(learning.object_course_id(name), auth.uid())
    or exists (
      select 1 from learning.lesson_blocks b
      join learning.lessons l on l.id = b.lesson_id
      where b.video_key = name 
        and learning.is_preview_lesson(l.id)
    )
  )
);

-- WRITE policy for course-media: course owners only
create policy "course-media write by owner"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'course-media'
  and exists (
    select 1 from learning.courses c
    join learning.instructors i on i.id = c.owner_id
    where c.id = learning.object_course_id(name)
      and i.user_id = auth.uid()
  )
);

-- UPDATE policy for course-media: course owners only
create policy "course-media update by owner"
on storage.objects for update
to authenticated
using (
  bucket_id = 'course-media'
  and exists (
    select 1 from learning.courses c
    join learning.instructors i on i.id = c.owner_id
    where c.id = learning.object_course_id(name)
      and i.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'course-media'
  and exists (
    select 1 from learning.courses c
    join learning.instructors i on i.id = c.owner_id
    where c.id = learning.object_course_id(name)
      and i.user_id = auth.uid()
  )
);

-- DELETE policy for course-media: course owners only
create policy "course-media delete by owner"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'course-media'
  and exists (
    select 1 from learning.courses c
    join learning.instructors i on i.id = c.owner_id
    where c.id = learning.object_course_id(name)
      and i.user_id = auth.uid()
  )
);

-- Public read policy for course-covers
create policy "course-covers public read"
on storage.objects for select
to public
using (bucket_id = 'course-covers');

-- WRITE policy for course-covers: course owners or instructors
create policy "course-covers write by owner"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'course-covers'
  and (
    -- Course cover
    exists (
      select 1 from learning.courses c
      join learning.instructors i on i.id = c.owner_id
      where c.id = learning.object_course_id(name)
        and i.user_id = auth.uid()
    )
    or
    -- Instructor avatar
    split_part(name, '/', 2) = 'instructor'
    and exists (
      select 1 from learning.instructors i
      where i.user_id = auth.uid()
        and i.id::text = split_part(name, '/', 3)
    )
  )
);

-- UPDATE policy for course-covers: course owners or instructors
create policy "course-covers update by owner"
on storage.objects for update
to authenticated
using (
  bucket_id = 'course-covers'
  and (
    exists (
      select 1 from learning.courses c
      join learning.instructors i on i.id = c.owner_id
      where c.id = learning.object_course_id(name)
        and i.user_id = auth.uid()
    )
    or
    (split_part(name, '/', 2) = 'instructor'
     and exists (
       select 1 from learning.instructors i
       where i.user_id = auth.uid()
         and i.id::text = split_part(name, '/', 3)
     ))
  )
)
with check (
  bucket_id = 'course-covers'
  and (
    exists (
      select 1 from learning.courses c
      join learning.instructors i on i.id = c.owner_id
      where c.id = learning.object_course_id(name)
        and i.user_id = auth.uid()
    )
    or
    (split_part(name, '/', 2) = 'instructor'
     and exists (
       select 1 from learning.instructors i
       where i.user_id = auth.uid()
         and i.id::text = split_part(name, '/', 3)
     ))
  )
);

-- DELETE policy for course-covers: course owners or instructors
create policy "course-covers delete by owner"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'course-covers'
  and (
    exists (
      select 1 from learning.courses c
      join learning.instructors i on i.id = c.owner_id
      where c.id = learning.object_course_id(name)
        and i.user_id = auth.uid()
    )
    or
    (split_part(name, '/', 2) = 'instructor'
     and exists (
       select 1 from learning.instructors i
       where i.user_id = auth.uid()
         and i.id::text = split_part(name, '/', 3)
     ))
  )
);

