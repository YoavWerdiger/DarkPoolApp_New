import type { NavigationProp } from '@react-navigation/native';
import { HapticFeedback } from '../utils/hapticFeedback';
import { rootNavigationRef } from '../navigation/rootNavigationRef';

export type UserProfileNavParams = {
  userId: string;
};

/**
 * פותח פרופיל משתמש — עצמי (הגדרות) או ציבורי (משתמש אחר).
 */
export function openUserProfile(
  userId: string,
  opts?: { currentUserId?: string | null; navigation?: NavigationProp<any> }
): void {
  if (!userId) return;
  void HapticFeedback.selection();

  const isSelf = !!opts?.currentUserId && opts.currentUserId === userId;
  const screen = isSelf ? 'ProfileMain' : 'PublicUserProfile';
  const params = isSelf ? undefined : { userId };

  const nav = opts?.navigation ?? (rootNavigationRef.isReady() ? rootNavigationRef : null);
  if (!nav) return;

  if ('navigate' in nav) {
    nav.navigate('Profile' as never, { screen, params } as never);
  }
}
