/**
 * פוש גלובלי בפתיחת וסגירת המסחר בוול סטריט.
 * רץ מ-pg_cron כל 5 דקות; מחשב את השעה ב-America/New_York (כך שעון קיץ/חורף
 * של ארה״ב וגם של ישראל מטופלים אוטומטית — 16:30/23:00 בישראל רוב השנה, ושעה
 * מוקדמת יותר בשבועות שבהם המעבר לא חופף), שולח פעם אחת ביום לכל אירוע
 * (נעילה ב-market_bell_log), ומדלג על סופי שבוע וחגי NYSE.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** חגי NYSE (ימים שבהם הבורסה סגורה) — 2026–2027 */
const NYSE_HOLIDAYS = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19',
  '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18',
  '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);
/** ימי סגירה מוקדמת (13:00 ET) */
const NYSE_EARLY_CLOSE = new Set(['2026-11-27', '2026-12-24', '2027-11-26']);

// קצר, בגובה העיניים, אימוג׳י אחד בכותרת — בלי «פעמון צלצל»/«תודה שהייתם איתנו»
const OPEN_MESSAGES = [
  { title: '🟢 השוק נפתח', body: 'וול סטריט פתוחה למסחר. בהצלחה לכולם היום!' },
  { title: '🟢 המסחר התחיל', body: 'שיהיה יום ירוק 📈' },
  { title: '🟢 יוצאים לדרך', body: 'השוק נפתח — תעבדו לפי התוכנית, בלי פומו.' },
  { title: '🟢 השוק פתוח', body: 'בואו נראה מה וול סטריט מביאה היום 👀' },
  { title: '🟢 נפתח המסחר', body: 'סבלנות ומשמעת. בהצלחה!' },
];
const CLOSE_MESSAGES = [
  { title: '🔴 השוק נסגר', body: 'יום המסחר הסתיים. נתראה מחר בפתיחה!' },
  { title: '🔴 סוף יום מסחר', body: 'זה הזמן לעדכן את יומן המסחר 📓' },
  { title: '🔴 המסחר נסגר', body: 'איך נגמר היום אצלכם? ספרו בקהילה 💬' },
  { title: '🔴 השוק סגור', body: 'יום נוסף מאחורינו. מחר ממשיכים 💪' },
  { title: '🔴 נסגר המסחר', body: 'מנוחה טובה — ניפגש בפתיחה.' },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** תאריך ושעה ב-ניו יורק */
function nyNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hour = Number(get('hour')) % 24;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: get('weekday'),
    minutes: hour * 60 + Number(get('minute')),
  };
}

serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? '';
  if (!SERVICE_KEY || auth !== `Bearer ${SERVICE_KEY}`) return json({ error: 'Unauthorized' }, 401);

  const url = new URL(req.url);
  const force = url.searchParams.get('force'); // 'open' | 'close' — בדיקה ידנית
  const now = nyNow();

  if (!force) {
    if (now.weekday === 'Sat' || now.weekday === 'Sun' || NYSE_HOLIDAYS.has(now.date)) {
      return json({ skipped: 'market closed', date: now.date });
    }
  }

  const OPEN_MIN = 9 * 60 + 30;
  const CLOSE_MIN = NYSE_EARLY_CLOSE.has(now.date) ? 13 * 60 : 16 * 60;
  // חלון של 10 דקות — cron כל 5 דקות תמיד נופל בתוכו
  let kind: 'open' | 'close' | null = null;
  if (force === 'open' || force === 'close') kind = force;
  else if (now.minutes >= OPEN_MIN && now.minutes < OPEN_MIN + 10) kind = 'open';
  else if (now.minutes >= CLOSE_MIN && now.minutes < CLOSE_MIN + 10) kind = 'close';
  if (!kind) return json({ skipped: 'not bell time', ny: now });

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // נעילה: פעם אחת ליום לכל אירוע
  if (!force) {
    const { data: lock, error: lockErr } = await supabase
      .from('market_bell_log')
      .insert({ trade_date: now.date, kind })
      .select('trade_date')
      .maybeSingle();
    if (lockErr || !lock) return json({ skipped: 'already sent', date: now.date, kind });
  }

  const list = kind === 'open' ? OPEN_MESSAGES : CLOSE_MESSAGES;
  const dayIndex = Math.floor(Date.parse(now.date) / 86_400_000);
  const msg = list[dayIndex % list.length];

  // משתמשים שכיבו התראות לגמרי — לא שולחים
  const { data: optedOut } = await supabase
    .from('user_notification_settings')
    .select('user_id')
    .eq('notifications_enabled', false);
  const blocked = new Set((optedOut ?? []).map((r: { user_id: string }) => r.user_id));

  const { data: tokens, error: tokErr } = await supabase
    .from('device_tokens')
    .select('expo_push_token, user_id')
    .eq('is_active', true);
  if (tokErr) return json({ error: tokErr.message }, 500);

  const seen = new Set<string>();
  const messages = (tokens ?? [])
    .filter((t: { expo_push_token: string | null; user_id: string }) =>
      typeof t.expo_push_token === 'string' &&
      t.expo_push_token.startsWith('ExponentPushToken') &&
      !blocked.has(t.user_id) &&
      !seen.has(t.expo_push_token) &&
      seen.add(t.expo_push_token))
    .map((t: { expo_push_token: string }) => ({
      to: t.expo_push_token,
      sound: 'default',
      title: msg.title,
      body: msg.body,
      data: { type: 'market_bell', kind },
      channelId: 'default',
    }));

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (EXPO_TOKEN) headers.Authorization = `Bearer ${EXPO_TOKEN}`;
    const res = await fetch(EXPO_URL, { method: 'POST', headers, body: JSON.stringify(batch) });
    if (!res.ok) {
      failed += batch.length;
      continue;
    }
    const result = await res.json();
    for (const ticket of Array.isArray(result?.data) ? result.data : []) {
      if (ticket?.status === 'ok') sent += 1;
      else failed += 1;
    }
  }

  if (!force) {
    await supabase
      .from('market_bell_log')
      .update({ sent_count: sent, failed_count: failed, title: msg.title })
      .eq('trade_date', now.date)
      .eq('kind', kind);
  }
  return json({ kind, date: now.date, sent, failed, title: msg.title });
});
