import { useCallback, useEffect, useState } from 'react';
import { listFollowedInvestors } from '../services/darkpool/darkPoolFollowService';
import {
  fetchFollowingFeed,
  type FollowingActivityItem,
} from '../services/darkpool/uwFollowingFeedService';
import { subscribeFollowChanges } from '../services/darkpool/darkPoolFollowService';

interface State {
  items: FollowingActivityItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  followingCount: number;
}

export function useDarkPoolFollowingFeed() {
  const [state, setState] = useState<State>({
    items: [],
    loading: true,
    refreshing: false,
    error: null,
    followingCount: 0,
  });

  const load = useCallback(async (refresh = false) => {
    setState((s) => ({
      ...s,
      loading: refresh ? s.loading : true,
      refreshing: refresh,
      error: null,
    }));
    try {
      const following = await listFollowedInvestors();
      if (!following.length) {
        setState({
          items: [],
          loading: false,
          refreshing: false,
          error: null,
          followingCount: 0,
        });
        return;
      }
      const payload = await fetchFollowingFeed(following, refresh);
      setState({
        items: payload.items,
        loading: false,
        refreshing: false,
        error: null,
        followingCount: following.length,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        refreshing: false,
        error: (e as Error).message,
      }));
    }
  }, []);

  useEffect(() => {
    void load();
    const unsub = subscribeFollowChanges(() => void load(true));
    return unsub;
  }, [load]);

  const refetch = useCallback(() => load(true), [load]);

  return { ...state, refetch };
}
