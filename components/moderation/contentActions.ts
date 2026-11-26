import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { showAppDialog, showAppAlert, showAppConfirm } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  blockUser,
  REPORT_REASONS,
  reportContent,
  unblockUser,
  type ReportTargetType,
} from '../../services/moderationService';

export type ModerationTarget = {
  targetType: ReportTargetType;
  targetId: string;
  /** מחבר התוכן — לחסימה ולתור האדמין */
  targetUserId?: string | null;
  targetName?: string | null;
  /** טקסט התוכן בזמן הדיווח */
  snapshot?: string | null;
};

/** בחירת סיבה ושליחת דיווח. */
export async function reportFlow(target: ModerationTarget): Promise<void> {
  const choice = await showAppDialog({
    title: 'דיווח',
    message: 'למה אתה מדווח על התוכן הזה? הצוות שלנו בודק כל דיווח תוך 24 שעות.',
    buttons: [...REPORT_REASONS.map((r) => ({ text: r.label })), { text: 'ביטול', style: 'cancel' as const }],
  });
  if (choice == null || choice >= REPORT_REASONS.length) return;
  const res = await reportContent({ ...target, reason: REPORT_REASONS[choice].key });
  if (res.ok) {
    void HapticFeedback.success();
    showAppAlert('תודה על הדיווח', 'קיבלנו את הדיווח ונבדוק אותו בהקדם.', 'success');
  } else {
    void HapticFeedback.error();
    showAppAlert('הדיווח לא נשלח', 'נסה שוב בעוד רגע.', 'error');
  }
}

/** אישור וחסימת משתמש. מחזיר true אם נחסם. */
export async function blockFlow(userId: string, name?: string | null): Promise<boolean> {
  const ok = await showAppConfirm(
    `לחסום את ${name || 'המשתמש'}?`,
    'לא תראה יותר הודעות, פוסטים, תגובות וסטוריז שלו. אפשר לבטל את החסימה בפרופיל שלו.',
    { confirmText: 'חסום', cancelText: 'ביטול', destructive: true },
  );
  if (!ok) return false;
  const done = await blockUser(userId);
  if (done) {
    void HapticFeedback.success();
    showAppAlert('המשתמש נחסם', undefined, 'success');
  } else {
    showAppAlert('החסימה נכשלה', 'נסה שוב בעוד רגע.', 'error');
  }
  return done;
}

export async function unblockFlow(userId: string): Promise<boolean> {
  const done = await unblockUser(userId);
  if (done) void HapticFeedback.success();
  else showAppAlert('ביטול החסימה נכשל', 'נסה שוב בעוד רגע.', 'error');
  return done;
}

/** תפריט «עוד» על תוכן של משתמש אחר: דיווח / חסימה. */
export async function openContentActions(target: ModerationTarget): Promise<void> {
  void HapticFeedback.selection();
  const canBlock = !!target.targetUserId;
  const choice = await showAppDialog({
    title: 'אפשרויות',
    buttons: [
      { text: 'דיווח על התוכן' },
      ...(canBlock ? [{ text: `חסימת ${target.targetName || 'המשתמש'}`, style: 'destructive' as const }] : []),
      { text: 'ביטול', style: 'cancel' as const },
    ],
  });
  if (choice === 0) await reportFlow(target);
  else if (canBlock && choice === 1) await blockFlow(target.targetUserId!, target.targetName);
}

/** A native action sheet as a promise — resolves the tapped index, or null on cancel. */
function nativeSheet(title: string, message: string | undefined, options: string[], destructiveIndex?: number): Promise<number | null> {
  return new Promise((resolve) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: [...options, 'ביטול'],
        cancelButtonIndex: options.length,
        destructiveButtonIndex: destructiveIndex,
      },
      (i) => resolve(i === options.length ? null : i),
    );
  });
}

/**
 * Report / block from inside a native full-screen modal (the story viewer).
 * The app's dialog is an RN <Modal>: stacking one on top of a native modal and swapping it for a
 * second one (menu → reasons) can crash iOS. Native action sheets and alerts present on whatever
 * is on top, so on iOS everything here stays native. Android keeps the app dialog.
 */
export async function openContentActionsOverModal(target: ModerationTarget): Promise<void> {
  if (Platform.OS !== 'ios') return openContentActions(target);
  void HapticFeedback.selection();
  const canBlock = !!target.targetUserId;
  const blockLabel = `חסימת ${target.targetName || 'המשתמש'}`;
  const choice = await nativeSheet('אפשרויות', undefined, ['דיווח על התוכן', ...(canBlock ? [blockLabel] : [])], canBlock ? 1 : undefined);
  if (choice === 0) {
    const reason = await nativeSheet(
      'דיווח',
      'למה אתה מדווח על התוכן הזה? הצוות שלנו בודק כל דיווח תוך 24 שעות.',
      REPORT_REASONS.map((r) => r.label),
    );
    if (reason == null) return;
    const res = await reportContent({ ...target, reason: REPORT_REASONS[reason].key });
    if (res.ok) {
      void HapticFeedback.success();
      Alert.alert('תודה על הדיווח', 'קיבלנו את הדיווח ונבדוק אותו בהקדם.');
    } else {
      void HapticFeedback.error();
      Alert.alert('הדיווח לא נשלח', 'נסה שוב בעוד רגע.');
    }
  } else if (canBlock && choice === 1) {
    const confirmed = await new Promise<boolean>((resolve) =>
      Alert.alert(
        `לחסום את ${target.targetName || 'המשתמש'}?`,
        'לא תראה יותר הודעות, פוסטים, תגובות וסטוריז שלו. אפשר לבטל את החסימה בפרופיל שלו.',
        [
          { text: 'ביטול', style: 'cancel', onPress: () => resolve(false) },
          { text: 'חסום', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      ),
    );
    if (!confirmed) return;
    const done = await blockUser(target.targetUserId!);
    if (done) void HapticFeedback.success();
    Alert.alert(done ? 'המשתמש נחסם' : 'החסימה נכשלה', done ? undefined : 'נסה שוב בעוד רגע.');
  }
}
