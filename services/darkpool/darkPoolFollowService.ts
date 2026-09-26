import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

const KEY = '@darkpool/followed_investors_v1';

export type InvestorKind = 'politician' | 'insider' | 'fund_manager';

export interface FollowedInvestor {
  id: string;
  kind: InvestorKind;
  name: string;
  image_url: string | null;
  ticker?: string;
}

type FollowListener = (list?: FollowedInvestor[]) => void;
const listeners = new Set<FollowListener>();

export function subscribeFollowChanges(fn: FollowListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyFollowChanged(list?: FollowedInvestor[]) {
  for (const fn of listeners) fn(list);
}

async function readLocal(): Promise<FollowedInvestor[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as FollowedInvestor[];
  } catch {
    return [];
  }
}

async function writeLocal(list: FollowedInvestor[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, 80)));
}

async function fetchCloudFollows(): Promise<FollowedInvestor[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await supabase
    .from('dark_pool_followed_investors')
    .select('person_id, kind, name, image_url, ticker, created_at')
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    console.warn('fetchCloudFollows', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.person_id),
    kind: row.kind as InvestorKind,
    name: String(row.name ?? ''),
    image_url: row.image_url ?? null,
    ticker: row.ticker ?? undefined,
  }));
}

async function mergeLocalAndCloud(): Promise<FollowedInvestor[]> {
  const [local, cloud] = await Promise.all([readLocal(), fetchCloudFollows()]);
  const map = new Map<string, FollowedInvestor>();
  for (const p of [...cloud, ...local]) {
    map.set(`${p.kind}:${p.id}`, p);
  }
  const merged = Array.from(map.values());
  await writeLocal(merged);
  return merged;
}

export async function listFollowedInvestors(forceSync = false): Promise<FollowedInvestor[]> {
  if (forceSync) return mergeLocalAndCloud();
  const local = await readLocal();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return local;
  if (local.length === 0) return mergeLocalAndCloud();
  return local;
}

export async function isFollowingInvestor(
  id: string,
  kind?: InvestorKind
): Promise<boolean> {
  const list = await listFollowedInvestors();
  return list.some((x) => x.id === id && (kind == null || x.kind === kind));
}

async function persistCloud(person: FollowedInvestor, follow: boolean) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  if (follow) {
    await supabase.from('dark_pool_followed_investors').upsert(
      {
        user_id: auth.user.id,
        person_id: person.id,
        kind: person.kind,
        name: person.name,
        image_url: person.image_url,
        ticker: person.ticker ?? null,
      },
      { onConflict: 'user_id,person_id,kind' }
    );
  } else {
    await supabase
      .from('dark_pool_followed_investors')
      .delete()
      .eq('user_id', auth.user.id)
      .eq('person_id', person.id)
      .eq('kind', person.kind);
  }
}

export async function toggleFollowInvestor(person: FollowedInvestor): Promise<boolean> {
  const list = await readLocal();
  const idx = list.findIndex((x) => x.id === person.id && x.kind === person.kind);
  let following: boolean;
  if (idx >= 0) {
    list.splice(idx, 1);
    following = false;
  } else {
    list.unshift(person);
    following = true;
  }
  await writeLocal(list);
  void persistCloud(person, following).catch((e) =>
    console.warn('persistCloud follow', (e as Error).message)
  );
  notifyFollowChanged(list);
  return following;
}

export async function unfollowInvestor(person: FollowedInvestor): Promise<void> {
  const list = await readLocal();
  const next = list.filter((x) => !(x.id === person.id && x.kind === person.kind));
  await writeLocal(next);
  void persistCloud(person, false).catch(() => {});
  notifyFollowChanged(next);
}

export async function syncFollowedFromCloud(): Promise<FollowedInvestor[]> {
  const merged = await mergeLocalAndCloud();
  notifyFollowChanged(merged);
  return merged;
}

export interface FollowCountRow {
  person: FollowedInvestor;
  follower_count: number;
}

type FollowCountRpcRow = {
  person_id?: string | null;
  kind?: string | null;
  follower_count?: number | string | null;
  name?: string | null;
  image_url?: string | null;
  ticker?: string | null;
};

/**
 * COUNT גלובלי מ-`dark_pool_followed_investors` דרך RPC.
 * אין "$ copied". בלי RPC (RLS מסתיר שורות של אחרים) מחזירים [] —
 * המסך מציג דיוקנאות בלי שורת כסף, לא ממציא דירוג.
 */
export async function countFollowedInvestors(): Promise<FollowCountRow[]> {
  const { data, error } = await supabase.rpc('dark_pool_investor_follow_counts');
  if (error || !Array.isArray(data)) {
    if (error) {
      console.warn('countFollowedInvestors', error.message);
    }
    return [];
  }

  return (data as FollowCountRpcRow[])
    .map((row) => {
      const id = String(row.person_id ?? '').trim();
      const kind = row.kind as InvestorKind | undefined;
      const follower_count = Number(row.follower_count);
      if (!id || !kind || !Number.isFinite(follower_count) || follower_count <= 0) {
        return null;
      }
      return {
        person: {
          id,
          kind,
          name: String(row.name ?? ''),
          image_url: row.image_url ?? null,
          ticker: row.ticker ?? undefined,
        },
        follower_count: Math.floor(follower_count),
      };
    })
    .filter((row): row is FollowCountRow => row != null)
    .sort((a, b) => b.follower_count - a.follower_count);
}
