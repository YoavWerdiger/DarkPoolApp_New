import { rootNavigationRef } from '../navigation/rootNavigationRef';

/** פתיחת פרופיל ציבורי של משתמש מכל מקום באפליקציה (גם מחוץ לסטאק הנוכחי) */
export function openUserProfile(userId: string | null | undefined): void {
  if (!userId || !rootNavigationRef.isReady()) return;
  (rootNavigationRef.navigate as (name: string, params?: object) => void)('PublicProfile', { userId });
}
