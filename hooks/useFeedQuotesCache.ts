import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../lib/appQueryKeys';
import { queryClient } from '../lib/queryClient';
import {
  isUsableFeedQuote,
  type FeedQuotesCache,
} from '../screens/DarkPool/utils/feedQuoteCache';
import type { PriceQuote } from '../screens/Portfolios/portfolioTypes';

function readFeedQuotesSnapshot(): FeedQuotesCache {
  return queryClient.getQueryData<FeedQuotesCache>(appQueryKeys.feedQuotes) ?? {};
}

/** מנוי לקאש הציטוטים — מתעדכן כש-setQueryData כותב ל-feedQuotes. */
export function useFeedQuotesCache(): FeedQuotesCache {
  const query = useQuery<FeedQuotesCache>({
    queryKey: appQueryKeys.feedQuotes,
    queryFn: async () => readFeedQuotesSnapshot(),
    enabled: false,
    staleTime: Infinity,
    initialData: readFeedQuotesSnapshot,
  });
  return query.data ?? {};
}

export function useCachedFeedQuote(ticker: string | null | undefined): PriceQuote | null {
  const cache = useFeedQuotesCache();
  const symbol =
    typeof ticker === 'string' ? ticker.trim().toUpperCase().replace(/^\$/, '') : '';
  if (!symbol) return null;
  const quote = cache[symbol];
  return isUsableFeedQuote(quote) ? quote : null;
}

export function useFeedQuotesPending(): boolean {
  const query = useQuery<boolean>({
    queryKey: appQueryKeys.feedQuotesPending,
    queryFn: async () => false,
    enabled: false,
    staleTime: Infinity,
    initialData: false,
  });
  return query.data === true;
}
