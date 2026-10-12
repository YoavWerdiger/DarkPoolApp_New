/**
 * נעילה לשרת בלבד: רק קריאה עם מפתח ה-service (cron/pg_net/פונקציות אחרות) מתקבלת.
 * מפתח ה-anon שבאפליקציה הוא JWT תקין — verify_jwt לבדו לא מספיק.
 */
export function isServiceCaller(req: Request): boolean {
  const auth = (req.headers.get('Authorization') ?? '').trim();
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();
  return !!serviceKey && auth === `Bearer ${serviceKey}`;
}

export function serviceOnlyDenied(): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * משתמש מחובר אמיתי (JWT של משתמש) או השרת. מפתח ה-anon לבדו נדחה —
 * /auth/v1/user מחזיר שגיאה לטוקן בלי משתמש.
 */
export async function isUserOrServiceCaller(req: Request): Promise<boolean> {
  if (isServiceCaller(req)) return true;
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return false;
    const u = await r.json().catch(() => null);
    return !!u?.id;
  } catch {
    return false;
  }
}
