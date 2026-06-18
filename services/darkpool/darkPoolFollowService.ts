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

type FollowListener = () => void;
const listeners = new Set<FollowListener>();

export function subscribeFollowChanges(fn: FollowListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyFollowChanged() {
  for (const fn of listeners) fn();
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
  notifyFollowChanged();
  return following;
}

export async function unfollowInvestor(person: FollowedInvestor): Promise<void> {
  const list = await readLocal();
  const next = list.filter((x) => !(x.id === person.id && x.kind === person.kind));
  await writeLocal(next);
  void persistCloud(person, false).catch(() => {});
  notifyFollowChanged();
}

export async function syncFollowedFromCloud(): Promise<FollowedInvestor[]> {
  const merged = await mergeLocalAndCloud();
  notifyFollowChanged();
  return merged;
}
