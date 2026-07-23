import { QueryClient } from '@tanstack/react-query';

/** זמן שבו הנתונים נחשבים "טריים" — לא נשלחת בקשה חוזרת */
export const APP_QUERY_STALE_MS = 5 * 60 * 1000;

/** זמן שהנתונים נשארים בזיכרון אחרי שאין observers */
export const APP_QUERY_GC_MS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: APP_QUERY_STALE_MS,
      gcTime: APP_QUERY_GC_MS,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});
