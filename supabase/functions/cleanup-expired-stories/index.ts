// מחיקת סטוריז שעברו 24 שעות מההעלאה (expires_at עבר): קודם הקבצים באחסון (chat-media),
// ואז השורות ב-user_stories (צפיות ותגובות נמחקות ב-ON DELETE CASCADE).
// מופעל כל שעה מ-pg_cron (invoke_cleanup_expired_stories) עם מפתח ה-service role בלבד.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'chat-media';
const BATCH = 100;

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey, {
    auth: { persistSession: false },
  });

  const { data: expired, error } = await supabase
    .from('user_stories')
    .select('id, media_url')
    .lt('expires_at', new Date().toISOString())
    .limit(1000);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!expired?.length) {
    return new Response(JSON.stringify({ deleted: 0, files: 0 }), { status: 200 });
  }

  // רק נתיבי אחסון (stories/<uid>/<ts>.jpg) — לא URL חיצוני
  const paths = expired
    .map((s) => s.media_url as string | null)
    .filter((u): u is string => !!u && !u.startsWith('http'));

  let filesRemoved = 0;
  for (let i = 0; i < paths.length; i += BATCH) {
    const chunk = paths.slice(i, i + BATCH);
    const { data: removed, error: rmError } = await supabase.storage.from(BUCKET).remove(chunk);
    if (rmError) {
      // לא מוחקים שורות אם הקבצים לא נמחקו — ננסה שוב בשעה הבאה
      return new Response(JSON.stringify({ error: rmError.message, filesRemoved }), { status: 500 });
    }
    filesRemoved += removed?.length ?? 0;
  }

  const ids = expired.map((s) => s.id);
  let rowsDeleted = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const { error: delError, count } = await supabase
      .from('user_stories')
      .delete({ count: 'exact' })
      .in('id', chunk)
      .lt('expires_at', new Date().toISOString());
    if (delError) {
      return new Response(JSON.stringify({ error: delError.message, filesRemoved, rowsDeleted }), { status: 500 });
    }
    rowsDeleted += count ?? 0;
  }

  return new Response(JSON.stringify({ deleted: rowsDeleted, files: filesRemoved }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
