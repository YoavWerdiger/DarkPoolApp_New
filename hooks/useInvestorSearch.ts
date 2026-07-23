import { useCallback, useEffect, useRef, useState } from 'react';
import { searchInvestors } from '../services/darkpool/investorSearchService';
import type { ExplorePerson } from '../services/darkpool/uwExploreService';

export function useInvestorSearch(query: string, debounceMs = 350) {
  const [results, setResults] = useState<ExplorePerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await searchInvestors(trimmed);
      if (id === reqId.current) setResults(rows);
    } catch (e) {
      if (id === reqId.current) {
        setError((e as Error).message);
        setResults([]);
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void search(query);
    }, debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs, search]);

  return { results, loading, error };
}
