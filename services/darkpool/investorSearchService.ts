import { supabase } from '../../lib/supabase';
import type { ExplorePerson } from './uwExploreService';

export async function searchInvestors(query: string): Promise<ExplorePerson[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const { data, error } = await supabase.functions.invoke<{
    results?: Array<{
      id: string;
      name: string;
      subtitle: string;
      image_url: string | null;
      kind: ExplorePerson['kind'];
      ticker?: string;
    }>;
    error?: string;
  }>('uw-investor-search', { body: { q } });

  if (error) throw error;
  if (data && 'error' in data && data.error) throw new Error(data.error);

  return (data?.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    subtitle: r.subtitle,
    image_url: r.image_url,
    kind: r.kind,
    ticker: r.ticker,
  }));
}
