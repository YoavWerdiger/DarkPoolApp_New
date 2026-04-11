DO $outer$
BEGIN
  -- Atomic rate limit check
  EXECUTE '
    CREATE OR REPLACE FUNCTION atomic_rate_check(
      p_user_id uuid,
      p_action text,
      p_window_start timestamptz,
      p_limit integer
    )
    RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $fn$
    DECLARE
      v_count integer;
    BEGIN
      INSERT INTO public.rate_limits (user_id, action, window_start, request_count)
      VALUES (p_user_id, p_action, p_window_start, 1)
      ON CONFLICT (user_id, action, window_start)
      DO UPDATE SET request_count = rate_limits.request_count + 1
      RETURNING request_count INTO v_count;

      IF v_count > p_limit THEN
        RETURN -1;
      END IF;

      RETURN v_count;
    END;
    $fn$';

  -- Get last messages for groups batch query
  EXECUTE '
    CREATE OR REPLACE FUNCTION get_last_messages_for_groups(group_ids uuid[])
    RETURNS TABLE (
      group_id uuid,
      content text,
      message_type text,
      created_at timestamptz,
      sender_id uuid
    )
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    AS $fn$
      SELECT DISTINCT ON (m.group_id)
        m.group_id,
        m.content,
        m.message_type,
        m.created_at,
        m.sender_id
      FROM public.chat_messages m
      WHERE m.group_id = ANY(group_ids)
        AND m.is_deleted = false
      ORDER BY m.group_id, m.created_at DESC;
    $fn$';
END;
$outer$;
