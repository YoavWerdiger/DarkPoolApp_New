import { useQuery } from '@tanstack/react-query';
import { appQueryKeys } from '../lib/appQueryKeys';
import {
  fearAndGreedService,
  type FearAndGreedResponse,
} from '../services/fearAndGreedService';

const FEAR_GREED_STALE_MS = 15 * 60 * 1000;

export function useFearAndGreed() {
  return useQuery<FearAndGreedResponse>({
    queryKey: appQueryKeys.fearGreed,
    queryFn: () => fearAndGreedService.getFearAndGreedIndex(),
    staleTime: FEAR_GREED_STALE_MS,
    // תמיד לרענן בכניסה למסך — מונע תקיעה על ערך ישן מ-queryPersist/AsyncStorage
    // אחרי ש-DB כבר עודכן (cron / fear-greed-update).
    refetchOnMount: 'always',
  });
}
