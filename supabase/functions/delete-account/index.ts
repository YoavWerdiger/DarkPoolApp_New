/**
 * delete-account — מחיקת/אנונימיזציה של חשבון המשתמש המחובר.
 * דורש JWT + אישור מוקלד "מחק" (+ סיסמה אופציונלית לאימות).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const jwt = authHeader.slice('Bearer '.length);
  const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !authData.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const userId = authData.user.id;
  const email = authData.user.email ?? '';

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const confirm = String(body.confirm || '').trim();
  if (confirm !== 'מחק') {
    return json({ error: 'יש להקליד מחק לאישור' }, 400);
  }

  const password = body.password ? String(body.password) : '';
  if (password && email) {
    const userClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signErr } = await userClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr) {
      return json({ error: 'סיסמה שגויה' }, 403);
    }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('subscription_role')
    .eq('id', userId)
    .maybeSingle();

  const role = String(profile?.subscription_role || '').toLowerCase();
  if (role === 'admin' || role === 'super_admin') {
    return json({ error: 'לא ניתן למחוק חשבון מנהל דרך האפליקציה' }, 403);
  }

  const now = new Date().toISOString();
  const anonEmail = `deleted_${userId.slice(0, 8)}@deleted.darkpool.local`;

  await supabase
    .from('users')
    .update({
      email: anonEmail,
      full_name: 'משתמש שנמחק',
      display_name: 'משתמש שנמחק',
      phone: null,
      profile_picture: null,
      avatar_url: null,
      deleted_at: now,
      deletion_requested_at: now,
      is_suspended: true,
      suspended_at: now,
      suspended_reason: 'account_deleted',
      subscription_role: 'free_user',
      subscription_plan: 'free',
    })
    .eq('id', userId);

  await supabase
    .from('device_tokens')
    .update({ is_active: false })
    .eq('user_id', userId);

  await supabase
    .from('user_subscriptions')
    .update({ status: 'cancelled', cancelled_at: now })
    .eq('user_id', userId)
    .eq('status', 'active');

  const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error('auth.admin.deleteUser failed', delErr);
    return json({
      error: 'החשבון סומן כמחוק, אך מחיקת Auth נכשלה. פנה לתמיכה.',
      partial: true,
    }, 500);
  }

  return json({ ok: true });
});
