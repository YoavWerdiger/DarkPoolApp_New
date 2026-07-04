-- ============================================================
-- 021: Learning content RLS — subscription-gated access
-- ============================================================

-- Add access column to courses if it doesn't exist yet
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS access TEXT NOT NULL DEFAULT 'free'
  CHECK (access IN ('free', 'paid', 'members_only'));

-- Default all existing courses to free (safe — no data loss)
UPDATE public.courses SET access = 'free' WHERE access IS NULL;

-- ============================================================
-- courses: free courses = everyone, paid = premium+ only
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view published courses" ON public.courses;
DROP POLICY IF EXISTS "Authenticated users can view courses" ON public.courses;

CREATE POLICY "Authenticated users can view courses"
  ON public.courses FOR SELECT
  TO authenticated
  USING (
    -- free courses always visible
    access = 'free'
    OR
    -- paid courses: require active premium/vip/admin subscription
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.subscription_role IN ('premium_user', 'vip_user', 'admin')
        AND (
          u.subscription_expires_at IS NULL
          OR u.subscription_expires_at > NOW()
        )
    )
  );

-- ============================================================
-- lessons: same gate as parent course
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view lessons" ON public.lessons;
DROP POLICY IF EXISTS "Authenticated users can view lessons" ON public.lessons;

CREATE POLICY "Authenticated users can view lessons"
  ON public.lessons FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = lessons.course_id
        AND (
          c.access = 'free'
          OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND u.subscription_role IN ('premium_user', 'vip_user', 'admin')
              AND (u.subscription_expires_at IS NULL OR u.subscription_expires_at > NOW())
          )
        )
    )
  );

-- ============================================================
-- lesson_media_links: same gate (video signed URLs)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view media links" ON public.lesson_media_links;
DROP POLICY IF EXISTS "Authenticated users can view media links" ON public.lesson_media_links;

CREATE POLICY "Authenticated users can view media links"
  ON public.lesson_media_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.courses c ON c.id = l.course_id
      WHERE l.id = lesson_media_links.lesson_id
        AND (
          c.access = 'free'
          OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND u.subscription_role IN ('premium_user', 'vip_user', 'admin')
              AND (u.subscription_expires_at IS NULL OR u.subscription_expires_at > NOW())
          )
        )
    )
  );

-- ============================================================
-- user_course_progress INSERT/UPDATE: block expired subscribers
-- ============================================================
DROP POLICY IF EXISTS "Users can insert progress" ON public.user_course_progress;
DROP POLICY IF EXISTS "Users can update progress" ON public.user_course_progress;

CREATE POLICY "Users can insert progress"
  ON public.user_course_progress FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.courses c ON c.id = l.course_id
      WHERE l.id = lesson_id
        AND (
          c.access = 'free'
          OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND u.subscription_role IN ('premium_user', 'vip_user', 'admin')
              AND (u.subscription_expires_at IS NULL OR u.subscription_expires_at > NOW())
          )
        )
    )
  );

CREATE POLICY "Users can update progress"
  ON public.user_course_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
