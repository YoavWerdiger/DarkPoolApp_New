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
