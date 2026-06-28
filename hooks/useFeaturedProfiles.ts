import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../lib/appQueryKeys';
import { fetchFeaturedProfiles, type FeaturedProfile } from '../services/darkpool/featuredProfilesService';

export function useFeaturedProfiles() {
  const forceRef = useRef(false);
  const query = useQuery<FeaturedProfile[]>({
    queryKey: appQueryKeys.featuredProfiles,
    queryFn: () => {
      const force = forceRef.current;
      forceRef.current = false;
      return fetchFeaturedProfiles(force);
    },
  });

  const refetch = useCallback(async () => {
    forceRef.current = true;
    await query.refetch();
  }, [query]);

  return {
    list: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch,
  };
}
