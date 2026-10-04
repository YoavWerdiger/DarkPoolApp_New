import { useEffect, useRef } from 'react';
import { CommonActions } from '@react-navigation/native';
import { useLinkingURL } from 'expo-linking';
import { useShareIntentContext } from 'expo-share-intent';
import { rootNavigationRef } from '../navigation/rootNavigationRef';
import { lockAndroidChatSoftInput } from '../components/chat/androidChatKeyboard';
import {
  assignIncomingShareToGroup,
  pendingShareFromIntent,
  setIncomingShare,
} from '../lib/pendingShare';
import { consumeShareTargetGroupId, groupIdFromChatShortcutUrl } from '../lib/shareTargets';
import { logger } from '../utils/logger';

function navigateToChat(params: Record<string, unknown>) {
  const attempt = (triesLeft: number) => {
    if (!rootNavigationRef.isReady()) {
      if (triesLeft <= 0) {
        logger.warn('useIncomingShare', 'Share navigation skipped — nav not ready');
        return;
      }
      setTimeout(() => attempt(triesLeft - 1), 120);
      return;
    }
    try {
      rootNavigationRef.dispatch(
        CommonActions.navigate({ name: 'Main', params: { screen: 'Chat', params } }),
      );
    } catch (error) {
      logger.error('useIncomingShare', 'Share navigation failed', error);
    }
  };
  attempt(25);
}

/**
 * תוכן מגיליון השיתוף של המערכת:
 * - נבחרה קבוצה משורת ההצעות → ישר לצ'אט
 * - אחרת → מסך בחירת קבוצה
 * וגם: קיצור קבוצה מהמשגר (Android) → פתיחת הצ'אט.
 */
export function useIncomingShare(enabled: boolean) {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const url = useLinkingURL();
  const handledShortcutUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !hasShareIntent) return;
    const share = pendingShareFromIntent(shareIntent);
    const targetGroupId = consumeShareTargetGroupId(url);
    resetShareIntent();
    if (!share) return;
    setIncomingShare(share);

    if (targetGroupId) {
      assignIncomingShareToGroup(targetGroupId);
      lockAndroidChatSoftInput();
      navigateToChat({ screen: 'ChatGroup', params: { groupId: targetGroupId }, initial: false });
    } else {
      navigateToChat({ screen: 'ShareToChat', initial: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetShareIntent מתחלף בכל רנדר
  }, [enabled, hasShareIntent, shareIntent]);

  useEffect(() => {
    if (!enabled || !url || handledShortcutUrl.current === url) return;
    const groupId = groupIdFromChatShortcutUrl(url);
    if (!groupId) return;
    handledShortcutUrl.current = url;
    lockAndroidChatSoftInput();
    navigateToChat({ screen: 'ChatGroup', params: { groupId }, initial: false });
  }, [enabled, url]);
}
