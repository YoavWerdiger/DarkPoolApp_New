-- ============================================================
-- 050: Mock unread badges + preview text for chat home screen
-- ============================================================
-- מטרה: לדמות הרבה הודעות שלא נקראו ברשימת הצ'אטים (באדג'ים, טאב Unread, @mentions).
--
-- איך להריץ:
--   1. Supabase Dashboard → SQL Editor → הדבק והרץ את הקובץ
--   או:  supabase db push / supabase migration up
--
-- לפני הרצה — עדכן את המשתמש המטרה (שורה 28–29):
--   v_target_user_id  := UUID שלך
--   או v_target_email := המייל שלך ב-auth
--
-- ניקוי אחרי בדיקה:
--   SELECT public.cleanup_chat_mock_unread();
-- ============================================================

-- ── פונקציית ניקוי (אפשר להריץ בנפרד) ─────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_chat_mock_unread()
RETURNS TABLE(deleted_messages bigint, reset_memberships bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted bigint;
  v_reset bigint;
  v_mock_groups uuid[];
BEGIN
  SELECT array_agg(DISTINCT group_id)
  INTO v_mock_groups
  FROM public.chat_messages
  WHERE content LIKE '🧪 [MOCK]%'
     OR content IN (
       'מישהו שאל על NVDA לפני דקה',
       '@אתה מה דעתך על הדוח?',
       'פניסטוק חם היום 🔥',
       '@אתה יכול להסביר על RSI?',
       'עסקת יום: TSLA +2.4%',
       'סטאפ חדש על AAPL',
       '@אתה ראית את הפריצה?'
     );

  DELETE FROM public.chat_messages
  WHERE content LIKE '🧪 [MOCK]%'
     OR content IN (
       'מישהו שאל על NVDA לפני דקה',
       '@אתה מה דעתך על הדוח?',
       'פניסטוק חם היום 🔥',
       '@אתה יכול להסביר על RSI?',
       'עסקת יום: TSLA +2.4%',
       'סטאפ חדש על AAPL',
       '@אתה ראית את הפריצה?'
     );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_mock_groups IS NOT NULL THEN
    UPDATE public.chat_group_members cgm
    SET
      unread_count = 0,
      mentioned_count = 0,
      last_read_at = now(),
      last_read_message_id = (
        SELECT cm.id
        FROM public.chat_messages cm
        WHERE cm.group_id = cgm.group_id
          AND COALESCE(cm.is_deleted, false) = false
        ORDER BY cm.created_at DESC
        LIMIT 1
      )
    WHERE cgm.group_id = ANY(v_mock_groups);
  END IF;

  GET DIAGNOSTICS v_reset = ROW_COUNT;

  deleted_messages := v_deleted;
  reset_memberships := v_reset;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_chat_mock_unread() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_chat_mock_unread() TO service_role;

-- תיקון הודעות מוק קיימות (אם כבר הורץ בעבר עם 🧪 [MOCK])
UPDATE public.chat_messages
SET content = REPLACE(content, '🧪 [MOCK] ', '')
WHERE content LIKE '🧪 [MOCK]%';

UPDATE public.chat_groups
SET last_message_preview = REPLACE(last_message_preview, '🧪 [MOCK] ', '')
WHERE last_message_preview LIKE '🧪 [MOCK]%';

-- ── Seed ────────────────────────────────────────────────────
DO $$
DECLARE
  -- ▼▼▼ שנה כאן ▼▼▼
  v_target_user_id uuid := '788f3e44-8e0c-447f-9891-0a2d2da5f520';
  v_target_email   text := NULL; -- לחלופין: 'your@email.com'
  -- ▲▲▲ שנה כאן ▲▲▲

  v_sender_id      uuid;
  v_group_id       uuid;
  v_last_read_id   uuid;
  v_new_msg_id     uuid;
  v_msg_count      integer;
  v_unread_target  integer;
  v_mentions       integer;
  v_preview        text;
  v_now            timestamptz := now();

  -- group_id, unread_count, mentioned_count, preview_suffix
  v_groups constant jsonb := '[
    {"id":"00000000-0000-0000-0000-000000000002","unread":24,"mentions":0,"preview":"מישהו שאל על NVDA לפני דקה"},
    {"id":"00000000-0000-0000-0000-000000000003","unread":12,"mentions":1,"preview":"@אתה מה דעתך על הדוח?"},
    {"id":"00000000-0000-0000-0000-000000000004","unread":147,"mentions":0,"preview":"פניסטוק חם היום 🔥"},
    {"id":"00000000-0000-0000-0000-000000000005","unread":8,"mentions":2,"preview":"@אתה יכול להסביר על RSI?"},
    {"id":"00000000-0000-0000-0000-000000000006","unread":42,"mentions":0,"preview":"עסקת יום: TSLA +2.4%"},
    {"id":"00000000-0000-0000-0000-000000000008","unread":6,"mentions":0,"preview":"סטאפ חדש על AAPL"},
    {"id":"00000000-0000-0000-0000-000000000009","unread":31,"mentions":1,"preview":"@אתה ראית את הפריצה?"}
  ]'::jsonb;

  g jsonb;
BEGIN
  IF v_target_user_id IS NULL AND v_target_email IS NOT NULL THEN
    SELECT id INTO v_target_user_id
    FROM auth.users
    WHERE lower(email) = lower(v_target_email)
    LIMIT 1;
  END IF;

  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user not found. Set v_target_user_id or v_target_email in migration 050.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_target_user_id) THEN
    RAISE EXCEPTION 'User % exists in auth but not in public.users', v_target_user_id;
  END IF;

  -- שולח מוק = משתמש אחר כלשהו (לא המטרה)
  SELECT u.id INTO v_sender_id
  FROM public.users u
  WHERE u.id <> v_target_user_id
  ORDER BY u.created_at
  LIMIT 1;

  IF v_sender_id IS NULL THEN
    v_sender_id := v_target_user_id; -- fallback יחיד במערכת
  END IF;

  -- ניקוי ריצה קודמת
  PERFORM public.cleanup_chat_mock_unread();

  FOR g IN SELECT * FROM jsonb_array_elements(v_groups)
  LOOP
    v_group_id := (g->>'id')::uuid;
    v_unread_target := (g->>'unread')::integer;
    v_mentions := COALESCE((g->>'mentions')::integer, 0);
    v_preview := g->>'preview';

    IF NOT EXISTS (
      SELECT 1 FROM public.chat_group_members
      WHERE group_id = v_group_id AND user_id = v_target_user_id
    ) THEN
      RAISE NOTICE 'Skip group % — user not a member', v_group_id;
      CONTINUE;
    END IF;

    SELECT count(*)::integer INTO v_msg_count
    FROM public.chat_messages cm
    WHERE cm.group_id = v_group_id
      AND COALESCE(cm.is_deleted, false) = false;

    -- הודעה "נקראה אחרונה" — N הודעות מהסוף (מוגבל למה שיש בפועל)
    v_last_read_id := NULL;
    IF v_msg_count > 0 THEN
      SELECT cm.id INTO v_last_read_id
      FROM public.chat_messages cm
      WHERE cm.group_id = v_group_id
        AND COALESCE(cm.is_deleted, false) = false
      ORDER BY cm.created_at DESC
      OFFSET LEAST(GREATEST(v_unread_target, 1), GREATEST(v_msg_count - 1, 0))
      LIMIT 1;
    END IF;

    -- הודעת מוק חדשה (מעדכנת preview + last_message_at דרך טריגר)
    INSERT INTO public.chat_messages (
      group_id,
      sender_id,
      content,
      message_type,
      mentioned_users,
      created_at
    ) VALUES (
      v_group_id,
      v_sender_id,
      v_preview,
      'text',
      CASE WHEN v_mentions > 0 THEN ARRAY[v_target_user_id]::uuid[] ELSE ARRAY[]::uuid[] END,
      v_now - (random() * interval '45 minutes')
    )
    RETURNING id INTO v_new_msg_id;

    -- unread_count ידני (מדויק ל-UI) — הטריגר כבר הוסיף +1, נתאים ליעד
    UPDATE public.chat_group_members
    SET
      unread_count = LEAST(v_unread_target, GREATEST(v_msg_count, 1)),
      mentioned_count = v_mentions,
      last_read_message_id = COALESCE(v_last_read_id, v_new_msg_id),
      last_read_at = v_now - interval '2 days'
    WHERE group_id = v_group_id
      AND user_id = v_target_user_id;

    -- עדכון preview בקבוצה (למקרה שהטריגר לא רץ)
    UPDATE public.chat_groups
    SET
      last_message_at = (SELECT created_at FROM public.chat_messages WHERE id = v_new_msg_id),
      last_message_preview = LEFT(v_preview, 100),
      updated_at = v_now
    WHERE id = v_group_id;

    RAISE NOTICE 'Seeded group % → unread=% mentions=%', v_group_id, v_unread_target, v_mentions;
  END LOOP;

  RAISE NOTICE 'Done. Target user: %', v_target_user_id;
END $$;

-- ── אימות ─────────────────────────────────────────────────
SELECT
  cg.name AS group_name,
  cgm.unread_count,
  cgm.mentioned_count,
  cgm.last_read_at,
  cg.last_message_preview,
  cg.last_message_at
FROM public.chat_group_members cgm
JOIN public.chat_groups cg ON cg.id = cgm.group_id
WHERE cgm.user_id = '788f3e44-8e0c-447f-9891-0a2d2da5f520' -- עדכן אם שינית למעלה
  AND (cgm.unread_count > 0 OR cgm.mentioned_count > 0)
ORDER BY cgm.unread_count DESC;
