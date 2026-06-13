// פיד פעילות — עסקאות של פוליטיקאים/בכירים שהמשתמש עוקב אחריהם

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  fetchUwCongressRecent,
  fetchUwInsiderTransactions,
  resolveUwLogoUrl,
  type UwCongressTrade,
  type UwInsiderTradeAgg,
} from '../_shared/unusualWhales.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONGRESS_PHOTO = 'https://unitedstates.github.io/images/congress/225x275';

interface FollowRef {
  id: string;
  kind: 'politician' | 'insider';
  name?: string;
  image_url?: string | null;
  ticker?: string;
}

interface ActivityItem {
  id: string;
  source: 'congress' | 'insider';
  person_id: string;
  person_kind: 'politician' | 'insider';
  person_name: string;
  person_image_url: string | null;
  ticker: string;
  issuer: string | null;
  txn_label: string;
  amount_label: string | null;
  activity_date: string | null;
  filed_label: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const key = Deno.env.get('UNUSUAL_WHALES_API_KEY') || '';
  if (!key) return json({ error: 'UNUSUAL_WHALES_API_KEY missing' }, 400);

  let body: { following?: FollowRef[] } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid body' }, 400);
  }

  const following = (body.following ?? []).filter((f) => f?.id && f?.kind);
  if (!following.length) {
    return json({ items: [], fetched_at: new Date().toISOString() }, 200);
  }

  const politicianIds = new Set(
    following.filter((f) => f.kind === 'politician').map((f) => f.id)
  );
  const insiderRefs = following.filter((f) => f.kind === 'insider');

  try {
    const [congress, insiderTx] = await Promise.all([
      politicianIds.size
        ? fetchUwCongressRecent(key, 150)
        : Promise.resolve([] as UwCongressTrade[]),
      insiderRefs.length
        ? fetchUwInsiderTransactions(key, {
            limit: 120,
            transactionCodes: ['P', 'S'],
            group: true,
            commonStockOnly: true,
          })
        : Promise.resolve([] as UwInsiderTradeAgg[]),
    ]);

    const byPol = new Map(
      following
        .filter((f) => f.kind === 'politician')
        .map((f) => [f.id, f])
    );
    const byInsider = new Map(
      insiderRefs.map((f) => [f.id, f])
    );

    const items: ActivityItem[] = [];

    for (const t of congress) {
      const pid = String(t.politician_id ?? '').trim();
      if (!politicianIds.has(pid)) continue;
      const meta = byPol.get(pid);
      const ticker = String(t.ticker ?? '').toUpperCase();
      if (!ticker) continue;
      const date = String(t.transaction_date ?? t.filed_at_date ?? '').slice(0, 10);
      items.push({
        id: `c:${pid}:${ticker}:${date}:${t.txn_type ?? ''}`,
        source: 'congress',
        person_id: pid,
        person_kind: 'politician',
        person_name: String(t.name ?? t.reporter ?? meta?.name ?? '').trim() || 'פוליטיקאי',
        person_image_url: meta?.image_url ?? null,
        ticker,
        issuer: t.issuer?.trim() || null,
        txn_label: formatTxn(t.txn_type),
        amount_label: t.amounts?.trim() || null,
        activity_date: date || null,
        filed_label: daysLabel(t.filed_at_date ?? t.transaction_date),
      });
    }

    for (const t of insiderTx) {
      const ticker = (t.ticker || '').toUpperCase();
      const owner = t.owner_name?.trim();
      if (!ticker || !owner) continue;
      const keyId = `${ticker}:${owner}`;
      const altKey = insiderRefs.find((r) => r.id === keyId || namesLooseMatch(r.id.split(':').slice(1).join(':'), owner));
      if (!altKey && !byInsider.has(keyId)) {
        for (const [id, ref] of byInsider) {
          if (matchInsiderRef(id, ref, ticker, owner)) {
            byInsider.set(keyId, ref);
            break;
          }
        }
      }
      const ref = byInsider.get(keyId) ?? insiderRefs.find((r) => matchInsiderRef(r.id, r, ticker, owner));
      if (!ref) continue;

      const date = String(t.transaction_date ?? t.filing_date ?? '').slice(0, 10);
      items.push({
        id: `i:${t.id ?? keyId}:${date}`,
        source: 'insider',
        person_id: ref.id,
        person_kind: 'insider',
        person_name: formatInsiderName(owner),
        person_image_url: ref.image_url ?? null,
        ticker,
        issuer: null,
        txn_label: t.transaction_code === 'S' ? 'מכירה' : 'רכישה',
        amount_label: t.amount != null ? `${t.amount} מניות` : null,
        activity_date: date || null,
        filed_label: daysLabel(t.transaction_date ?? t.filing_date),
      });
    }

    items.sort((a, b) => {
      const da = a.activity_date ?? '';
      const db = b.activity_date ?? '';
      return db.localeCompare(da);
    });

    const deduped = dedupeItems(items).slice(0, 60);

    return json({ items: deduped, fetched_at: new Date().toISOString() }, 200);
  } catch (e) {
    console.error('uw-following-feed', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function matchInsiderRef(
  id: string,
  ref: FollowRef,
  ticker: string,
  owner: string
): boolean {
  if (id.includes(':')) {
    const [t, ...rest] = id.split(':');
    const namePart = rest.join(':');
    if (t.toUpperCase() === ticker && namesLooseMatch(namePart, owner)) return true;
  }
  if (ref.ticker?.toUpperCase() === ticker && ref.name && namesLooseMatch(ref.name, owner)) {
    return true;
  }
  return false;
}

function dedupeItems(items: ActivityItem[]): ActivityItem[] {
  const seen = new Set<string>();
  const out: ActivityItem[] = [];
  for (const it of items) {
    const k = `${it.person_id}:${it.ticker}:${it.activity_date}:${it.txn_label}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function formatTxn(raw?: string): string {
  const t = (raw || '').toLowerCase();
  if (t.includes('purchase') || t === 'buy') return 'רכישה';
  if (t.includes('sale') || t === 'sell') return 'מכירה';
  return raw?.trim() || 'עסקה';
}

function daysLabel(iso: unknown): string | null {
  if (!iso || typeof iso !== 'string') return null;
  const d = Date.parse(iso.slice(0, 10));
  if (!Number.isFinite(d)) return null;
  const days = Math.max(0, Math.floor((Date.now() - d) / 86400000));
  return `לפני ${days} ימים`;
}

function formatInsiderName(raw: string): string {
  const p = raw.trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return raw;
  return `${p.slice(1).join(' ')} ${p[0]}`.trim();
}

function namesLooseMatch(a: string, b: string): boolean {
  const ta = new Set(
    a.toUpperCase().replace(/[.,']/g, '').split(' ').filter((t) => t.length > 1)
  );
  const tb = new Set(
    b.toUpperCase().replace(/[.,']/g, '').split(' ').filter((t) => t.length > 1)
  );
  if (!ta.size || !tb.size) return false;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  return overlap >= Math.min(2, Math.min(ta.size, tb.size));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
