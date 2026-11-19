/**
 * n8n-news-toggle — אדמין בלבד: מצב / הפעלה / כיבוי של אוטומציית החדשות ב-n8n.
 *
 * GET  → { active, name }
 * POST { active: boolean } → מפעיל / עוצר את ה-workflow → { active }
 *
 * מפתח ה-API של n8n נשמר רק כ-secret בשרת (לא באפליקציה):
 *   N8N_API_KEY, N8N_BASE_URL (https://<org>.app.n8n.cloud), N8N_NEWS_WORKFLOW_ID
 */
import { adminCorsHeaders, jsonResponse, requireAdmin } from '../_shared/adminAuth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: adminCorsHeaders });

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const apiKey = Deno.env.get('N8N_API_KEY') ?? '';
  const baseUrl = (Deno.env.get('N8N_BASE_URL') ?? '').replace(/\/$/, '');
  const workflowId = Deno.env.get('N8N_NEWS_WORKFLOW_ID') ?? '';
  if (!apiKey || !baseUrl || !workflowId) {
    return jsonResponse({ error: 'n8n לא מוגדר בשרת (N8N_API_KEY / N8N_BASE_URL / N8N_NEWS_WORKFLOW_ID)' }, 503);
  }

  const n8n = async (path: string, method = 'GET') => {
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' },
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body: body as Record<string, unknown> };
  };

  try {
    if (req.method === 'GET') {
      const r = await n8n(`/workflows/${workflowId}`);
      if (!r.ok) return jsonResponse({ error: `n8n ${r.status}` }, 502);
      return jsonResponse({ active: r.body.active === true, name: r.body.name ?? null });
    }

    if (req.method === 'POST') {
      const payload = await req.json().catch(() => ({}));
      const want = (payload as { active?: unknown }).active;
      if (typeof want !== 'boolean') return jsonResponse({ error: 'active (boolean) חובה' }, 400);
      const r = await n8n(`/workflows/${workflowId}/${want ? 'activate' : 'deactivate'}`, 'POST');
      if (!r.ok) return jsonResponse({ error: `n8n ${r.status}` }, 502);
      console.log('[n8n-news-toggle]', { admin: auth.adminId, active: r.body.active === true });
      return jsonResponse({ active: r.body.active === true });
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (e) {
    console.error('[n8n-news-toggle] failed', e);
    return jsonResponse({ error: 'n8n לא זמין' }, 502);
  }
});
