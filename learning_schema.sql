-- Learning System Schema
-- Create learning schema and all required tables with RLS policies

-- Create schema
create schema if not exists learning;

-- Create enums
create type learning.access_level as enum ('free', 'registration', 'paid');
create type learning.block_type as enum ('video', 'text', 'pdf', 'quiz');
create type learning.quiz_type as enum ('single', 'multiple', 'truefalse');
create type learning.progress_status as enum ('not_started', 'in_progress', 'completed');

-- Instructors table (links to auth.users)
create table if not exists learning.instructors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  bio text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Courses table
create table if not exists learning.courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  subtitle text,
  description text,
  cover_url text,
  access learning.access_level not null default 'free',
  language text default 'he',
  published boolean default false,
  owner_id uuid not null references learning.instructors(id) on delete restrict,
  preview_enabled boolean default true,
  preview_lesson_count int default 1,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Modules table (sections within a course)
create table if not exists learning.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references learning.courses(id) on delete cascade,
  title text not null,
  description text,
  sort_index int not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(course_id, sort_index)
);

-- Lessons table (parent for blocks)
create table if not exists learning.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references learning.modules(id) on delete cascade,
  title text not null,
  duration_seconds int,
  is_preview boolean default false, -- accessible without enrollment if course.preview_enabled
  sort_index int not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(module_id, sort_index)
);

-- Lesson blocks table (video/text/pdf/quiz)
create table if not exists learning.lesson_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references learning.lessons(id) on delete cascade,
  type learning.block_type not null,
  sort_index int not null,
  -- content fields (nullable depending on type)
  text_md text,               -- for type 'text' (markdown)
  pdf_url text,               -- for type 'pdf'
  video_key text,             -- for type 'video' -> storage object path
  video_poster_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(lesson_id, sort_index)
);

-- Quiz questions table
create table if not exists learning.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references learning.lesson_blocks(id) on delete cascade,
  type learning.quiz_type not null,
  prompt text not null,
  choices text[] default '{}',     -- for single/multiple
  correct_indices int[] default '{}',
  explanation text,
  created_at timestamptz default now()
);

-- Enrollments table
create table if not exists learning.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references learning.courses(id) on delete cascade,
  status text not null default 'active', -- future use: refunded, banned
  created_at timestamptz default now(),
  unique(user_id, course_id)
);

-- Lesson progress table
create table if not exists learning.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references learning.lessons(id) on delete cascade,
  status learning.progress_status not null default 'not_started',
  last_position_seconds int default 0,
  completed_at timestamptz,
  updated_at timestamptz default now(),
  unique(user_id, lesson_id)
);

-- Quiz attempts table
create table if not exists learning.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  block_id uuid not null references learning.lesson_blocks(id) on delete cascade,
  answers int[] default '{}',        -- indices selected
  is_correct boolean,
  score numeric(5,2),
  created_at timestamptz default now()
);

-- Course reviews table (optional)
create table if not exists learning.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references learning.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique(course_id, user_id)
);

-- Create indexes for better performance
create index idx_courses_published on learning.courses(published);
create index idx_courses_access on learning.courses(access);
create index idx_courses_owner on learning.courses(owner_id);
create index idx_modules_course_sort on learning.modules(course_id, sort_index);
create index idx_lessons_module_sort on learning.lessons(module_id, sort_index);
create index idx_lesson_blocks_lesson_sort on learning.lesson_blocks(lesson_id, sort_index);
create index idx_enrollments_user on learning.enrollments(user_id);
create index idx_enrollments_course on learning.enrollments(course_id);
create index idx_lesson_progress_user_lesson on learning.lesson_progress(user_id, lesson_id);
create index idx_quiz_attempts_user_block on learning.quiz_attempts(user_id, block_id);

