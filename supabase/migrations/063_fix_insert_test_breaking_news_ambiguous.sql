-- ============================================================================
-- 063_fix_insert_test_breaking_news_ambiguous.sql
-- article_id ב-RETURNS TABLE מתנגש עם עמודת הטבלה — alias pn.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.insert_test_breaking_news(
  p_label  TEXT DEFAULT NULL,
  p_text   TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'Reuters'
)
RETURNS TABLE (
  article_id           TEXT,
  article_label        TEXT,
  pending_created      BIGINT,
  pending_sent         BIGINT,
  pending_still_waiting BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_id    TEXT;
  v_label TEXT;
  v_text  TEXT;
  v_now   TIMESTAMPTZ := NOW();
BEGIN
  v_id := 'test_push_' || FLOOR(EXTRACT(EPOCH FROM v_now))::TEXT || '_' || FLOOR(RANDOM() * 10000)::TEXT;
  v_label := COALESCE(
    NULLIF(TRIM(p_label), ''),
    'בדיקת Push: Apple (AAPL) עולה 2.4% לפני דיווח'
  );
  v_text := COALESCE(
    NULLIF(TRIM(p_text), ''),
    'המניה AAPL ב-$198.50. תגובת השוק לפני דיווח רבעוני — בדיקת BiDi.'
  );

  INSERT INTO public.app_news_clean (id, label, text, source, time, img)
  VALUES (
    v_id,
    v_label,
    v_text,
    COALESCE(NULLIF(TRIM(p_source), ''), 'Reuters'),
    TO_CHAR(v_now, 'YYYY-MM-DD HH24:MI:SS'),
    NULL
  );

  PERFORM pg_sleep(2);

  RETURN QUERY
  SELECT
    v_id,
    v_label,
    s.created,
    s.sent,
    s.waiting
  FROM (
    SELECT
      COUNT(*)::BIGINT AS created,
      COUNT(*) FILTER (WHERE pn.is_sent = true)::BIGINT AS sent,
      COUNT(*) FILTER (WHERE pn.is_sent = false)::BIGINT AS waiting
    FROM public.pending_notifications pn
    WHERE pn.notification_type = 'news'
      AND pn.article_id = v_id
  ) s;
END;
$$;
