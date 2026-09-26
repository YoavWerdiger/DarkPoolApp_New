import { queryClient } from '../../lib/queryClient';
import { appQueryKeys } from '../../lib/appQueryKeys';
import {
  CHART_DAILY_CLOSES_STALE_MS,
  PROFILE_QUERY_GC_MS,
  PROFILE_QUERY_STALE_MS,
} from '../../lib/profileQueryCache';
import { isTrumpPerson } from '../../screens/DarkPool/utils/trumpHoldings';
import {
  listCongressHoldingsByBioguide,
  listCongressTradesForPerson,
} from './darkPoolDbCacheService';
import { listInsiderTradesForPerson } from './darkPoolService';
import { fetchFundHoldingsHistory, fetchFundProfile } from './uwFundProfileService';
import { fetchInvestorProfile } from './uwInvestorProfileService';
import { CURATED_EXPLORE_PROFILES } from '../../screens/DarkPool/utils/curatedExploreProfiles';

export type PersonPortfolioPrefetchParams = {
  id: string;
  kind: 'politician' | 'insider' | 'fund_manager';
  ticker?: string;
  nameHint?: string;
};

const profilePrefetchOpts = {
  staleTime: PROFILE_QUERY_STALE_MS,
  gcTime: PROFILE_QUERY_GC_MS,
} as const;

/** טוען מראש פרופיל + DB לפני push — chart/yahoo ימשיכו ברקע. */
export function prefetchPersonPortfolio(params: PersonPortfolioPrefetchParams): void {
  const id = params.id.trim();
  if (!id) return;
  const { kind, ticker, nameHint } = params;

  if (kind === 'fund_manager') {
    void queryClient.prefetchQuery({
      queryKey: appQueryKeys.fundProfile(id),
      queryFn: () => fetchFundProfile(id),
      ...profilePrefetchOpts,
    });
    void queryClient.prefetchQuery({
      queryKey: appQueryKeys.fundHoldingsHistory(id),
      queryFn: () => fetchFundHoldingsHistory(id),
      ...profilePrefetchOpts,
    });
    return;
  }

  void queryClient.prefetchQuery({
    queryKey: appQueryKeys.investorProfile(id, kind, ticker),
    queryFn: () => fetchInvestorProfile(id, kind, ticker),
    ...profilePrefetchOpts,
  });

  if (kind === 'politician') {
    void queryClient.prefetchQuery({
      queryKey: appQueryKeys.congressPersonTrades(id),
      queryFn: () => listCongressTradesForPerson(id),
      ...profilePrefetchOpts,
    });
    const bioguide = id.toUpperCase();
    if (/^[A-Z]\d{6}$/.test(bioguide) && !isTrumpPerson(id, nameHint)) {
      void queryClient.prefetchQuery({
        queryKey: appQueryKeys.congressHoldingsByBioguide(bioguide),
        queryFn: () => listCongressHoldingsByBioguide(bioguide),
        ...profilePrefetchOpts,
      });
    }
  }

  const insiderName = nameHint?.trim();
  if (kind === 'insider' && insiderName && insiderName.length > 1) {
    void queryClient.prefetchQuery({
      queryKey: appQueryKeys.insiderPersonTrades(insiderName),
      queryFn: () => listInsiderTradesForPerson(insiderName, 400, id),
      ...profilePrefetchOpts,
    });
  }
}

/** מחמם פרופילים מאוצרים ברקע (אחרי explore / warm). */
export function prefetchCuratedPersonPortfolios(limit = 10): void {
  for (const row of CURATED_EXPLORE_PROFILES.slice(0, limit)) {
    prefetchPersonPortfolio({
      id: row.id,
      kind: row.kind,
      ticker: row.ticker,
      nameHint: row.name,
    });
  }
}

/** re-export for callers that only need stale hint */
export { CHART_DAILY_CLOSES_STALE_MS, PROFILE_QUERY_STALE_MS, PROFILE_QUERY_GC_MS };
