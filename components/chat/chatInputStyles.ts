/** סגנונות של ChatInput.tsx — הועברו מקובץ המסך (פריט 52, פיצול קבצים ענקיים). */
import { ROOT_DIR, UI_DIR } from '../../lib/i18n/direction';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import UICard from '../ui/UICard';
import { APP_TYPE } from '../ui/appType';

export const createStyles = (tokens: any, paddingBottom: number) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingTop: 2,
    paddingBottom,
    gap: 0,
  },

  clipboardChipRow: {
    direction: UI_DIR,
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: tokens.spacing.sm,
  },
  clipboardChipOuter: {
    borderRadius: tokens.borderRadius.full,
    overflow: 'hidden',
  },
  clipboardChip: {
    direction: UI_DIR,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  clipboardChipText: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    fontWeight: '600',
    color: tokens.colors.primary.main,
  },
  replyPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: tokens.colors.background.cardSolid,
    marginHorizontal: tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: tokens.borderRadius.lg,
    overflow: 'hidden',
  },
  /** כמו replyBar בבועת הודעה – פס אנכי ישר, לא בורדר מעוגל */
  replyPreviewBar: {
    width: 3,
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 1.5,
    // כמו replyBar בבועה — צמוד לטקסט
    marginLeft: 8,
    flexShrink: 0,
    minHeight: 24,
    alignSelf: 'stretch',
  },
  replyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  replyLabel: {
    fontSize: tokens.typography.label.size,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.primary.main,
    marginBottom: 2,
    textAlign: 'right',
  },
  replyText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  replyThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 8,
    alignSelf: 'center',
  },
  cancelReply: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: tokens.colors.border.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    alignSelf: 'center',
  },
  cancelReplyText: {
    fontSize: 18,
    color: tokens.colors.text.secondary,
  },

  /** רדיוס בלבד — רקע/מסגרת מגיעים מ־UICard variant="glass" */
  inputCardOuter: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
  },
  inputCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.sm + 1,
    paddingVertical: tokens.spacing.xs + 1,
    gap: tokens.spacing.xs,
    minHeight: 46,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: tokens.colors.background.navChrome,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 88,
    paddingHorizontal: tokens.spacing.md - 2,
    paddingVertical: tokens.spacing.sm - 1,
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.primary,
    textAlignVertical: 'center',
    textAlign: 'right',
  },
  // בגובה כפתור ה-+ (40) ונשאר למטה כשהשדה גדל לכמה שורות
  emojiButton: {
    alignSelf: 'flex-end',
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charCounter: {
    position: 'absolute',
    bottom: 4,
    left: 8,
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.text.tertiary,
  },
  charCounterDanger: {
    color: tokens.colors.text.danger,
    fontWeight: tokens.typography.fontWeight.semibold,
  },

  /** שורת הקלטה/פריוויו: מחיקה+השהה/נגן · זמן+גלים (✓ או שליחה מחוץ לגלולה) */
  recordingRowFull: {
    flex: 1,
    flexDirection: 'row',
    direction: ROOT_DIR,
    alignItems: 'center',
    gap: 12,
    minHeight: 40,
    minWidth: 0,
  },
  recordingLeftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  recordingCenterCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  waveformWrapper: {
    flex: 1,
    minWidth: 0,
    height: 28,
    justifyContent: 'center',
    paddingStart: 2,
    paddingEnd: 2,
  },
  waveformPreviewWrapper: {
    flex: 1,
    minWidth: 0,
    height: 28,
    justifyContent: 'center',
    paddingStart: 2,
    paddingEnd: 2,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    paddingStart: 2,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  recordingTime: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  timelineContainer: {
    flex: 1,
    height: 3,
    position: 'relative',
    marginHorizontal: 4,
    justifyContent: 'center',
    minWidth: 60,
  },
  timelineLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: 1,
  },
  timelineDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.primary.main,
    marginRight: -3,
    top: -1.5,
  },

  sendBtnTouchable: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /**
   * Mic-specific hit target lifted above adjacent glass/overlay layers on
   * Android. Without elevation the underlying Pressable/View could be shadowed
   * by the glass pill's blur layer and drop occasional taps.
   */
  micGestureTarget: {
    zIndex: 10,
    ...(Platform.OS === 'android' ? { elevation: 6 } : null),
  },
  /**
   * Standalone circular send/mic button outside the input pill — WhatsApp
   * style. Also lifted above sibling layers on Android to guarantee the
   * touch reaches the button (see micGestureTarget rationale).
   */
  sendBtnOuter: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: tokens.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginStart: 8,
    alignSelf: 'flex-end',
    marginBottom: 3,
    zIndex: 10,
    ...(Platform.OS === 'android' ? { elevation: 6 } : null),
  },

  /** Used only inside recording rows */
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  pauseResumeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.border.hover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  uploadingContainer: {
    padding: 12,
    alignItems: 'center',
  },
  uploadingText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
  },
});
