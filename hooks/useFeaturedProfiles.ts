import { useCallback, useEffect, useState } from 'react';
import { fetchFeaturedProfiles, type FeaturedProfile } from '../services/darkpool/featuredProfilesService';

export function useFeaturedProfiles() {
  const [list, setList] = useState<FeaturedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    try {
      setError(null);
      setList(await fetchFeaturedProfiles(force));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const refetch = useCallback(async () => {
    await load(true);
  }, [load]);

  return { list, loading, error, refetch };
}
