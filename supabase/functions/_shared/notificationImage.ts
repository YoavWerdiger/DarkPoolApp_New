/**
 * תמונה להתראת Push — בלי לחתום עם service role על קבצים פרטיים.
 *
 * - URL חיצוני ב-HTTPS (לא של Supabase Storage) — חוזר כמו שהוא.
 * - URL של Storage בפרויקט הזה ב-bucket ציבורי — חוזר כ-URL ציבורי.
 * - bucket פרטי (chat-media, course-media, media...) או host אחר שמתחזה ל-Storage — null.
 *   קודם הפונקציה חתמה על כל bucket/נתיב שהגיע מהנתונים, וכך אפשר היה להוציא קישור לקובץ פרטי.
 * - נתיב יחסי ב-chat-media (תמונת קבוצה ישנה) — נחתם רק כשהוא בתיקיית הקבוצה עצמה (allowChatMediaGroupId).
 */
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';

const PUBLIC_BUCKETS = new Set([
  'app-media',
  'backgrounds',
  'course-covers',
  'course_media',
  'groups',
  'user-avatars',
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function projectHost(): string | null {
  try {
    return new URL(Deno.env.get('SUPABASE_URL') ?? '').host || null;
  } catch {
    return null;
  }
}

function safePath(path: string): boolean {
  return !path.split('/').some((seg) => seg === '' || seg === '.' || seg === '..');
}

export async function ensureNotificationImageUrl(
  supabase: ReturnType<typeof createClient>,
  rawUrl: string | null | undefined,
  opts: { allowChatMediaGroupId?: string | null } = {},
): Promise<string | null> {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();

  const groupId = opts.allowChatMediaGroupId;
  if (!trimmed.startsWith('http')) {
    if (!groupId || !UUID.test(groupId)) return null;
    let path: string;
    try {
      path = decodeURIComponent(trimmed);
    } catch {
      return null;
    }
    if (!path.startsWith(`${groupId}/`) || !safePath(path)) return null;
    const { data: signed } = await supabase.storage.from('chat-media').createSignedUrl(path, 3600);
    return signed?.signedUrl ?? null;
  }

  if (!trimmed.startsWith('https://')) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)/);
  const looksLikeStorage = match != null || url.hostname.includes('supabase');
  if (!looksLikeStorage) return trimmed;

  const host = projectHost();
  if (!match || !host || url.host !== host) return null;
  const [, bucket, rawPath] = match;
  let path: string;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (!PUBLIC_BUCKETS.has(bucket) || !safePath(path)) return null;
  return `https://${host}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
