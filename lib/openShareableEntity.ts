/**
 * ניווט מ־ShareableAttachment.ref — אותו מיפוי כמו notificationRouting.
 *
 * journal_trade: אין יעד מודרני (יומן ישן deprecated) — התוכן מוצג
 * בכרטיס ההטמעה עצמו (expand); אין deep-link.
 */

import { legacyAlert } from '../utils/appDialog';
import {
  buildNotificationNavigateArgs,
  type NotificationNavTarget,
} from '../lib/notificationRouting';
import { rootNavigationRef } from '../navigation/rootNavigationRef';
import type { ShareableAttachment, ShareableEntityRef } from '../types/shareableEntity';

export function entityRefToNavTarget(ref: ShareableEntityRef): NotificationNavTarget | null {
  switch (ref.type) {
    case 'person_profile': {
      const kind = ref.extras?.kind;
      if (!kind) return null;
      return {
        kind: 'dark_pool_person',
        personId: ref.id,
        personKind: kind,
        ticker: ref.extras?.ticker,
        nameHint: ref.extras?.nameHint,
      };
    }
    case 'news_article':
      return { kind: 'news', articleId: ref.id };
    case 'journal_trade':
      // Snapshot בלבד בכרטיס — לא מנווטים ליומן הישן / Journal stack
      return null;
    default:
      return null;
  }
}

/** האם יש מסך יעד לפתיחה (לא snapshot-only) */
export function canOpenShareableEntity(attachment: ShareableAttachment): boolean {
  return entityRefToNavTarget(attachment.ref) != null;
}

export function openShareableEntity(attachment: ShareableAttachment): void {
  // טריידים: רק תוכן inline בכרטיס — בלי ניווט ל־Journal deprecated
  if (attachment.ref.type === 'journal_trade') {
    return;
  }

  const target = entityRefToNavTarget(attachment.ref);
  if (!target) {
    legacyAlert('לא זמין', 'לא ניתן לפתוח את התוכן הזה כרגע');
    return;
  }

  const args = buildNotificationNavigateArgs(target);
  if (!rootNavigationRef.isReady()) return;
  rootNavigationRef.navigate(args.name as never, args.params as never);
}
