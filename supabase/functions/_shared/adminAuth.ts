import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';

export const adminCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...adminCorsHeaders, 'Content-Type': 'application/json' },
  });
}

export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireAdmin(req: Request): Promise<
  | { ok: true; adminId: string; supabase: SupabaseClient }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, response: jsonResponse({ error: 'Unauthorized' }, 401) };
  }

  const supabase = createServiceClient();
  const jwt = authHeader.slice('Bearer '.length);
  const { data: authData, error: authError } = await supabase.auth.getUser(jwt);

  if (authError || !authData.user) {
    return { ok: false, response: jsonResponse({ error: 'Unauthorized' }, 401) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, subscription_role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, response: jsonResponse({ error: 'Forbidden' }, 403) };
  }

  const role = String(profile.subscription_role || '').toLowerCase();
  if (!ADMIN_ROLES.has(role)) {
    return { ok: false, response: jsonResponse({ error: 'Forbidden — admin only' }, 403) };
  }

  return { ok: true, adminId: profile.id, supabase };
}

export async function writeAdminAudit(
  supabase: SupabaseClient,
  adminId: string,
  action: string,
  targetUserId: string | null,
  meta: Record<string, unknown> = {},
) {
  await supabase.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId,
    meta,
  });
}
