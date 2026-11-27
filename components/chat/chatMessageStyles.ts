/** סגנונות של ChatMessage.tsx — הועברו מקובץ המסך (פריט 52, פיצול קבצים ענקיים). */
import { ROOT_DIR, UI_DIR } from '../../lib/i18n/direction';
import { TEXT_DIR } from '../../lib/i18n/language';
import { View, StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { LIGHT_CANVAS } from '../ui/designTokensStatic';
import MessageReactions from './MessageReactions';
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';
import { blackAlpha, whiteAlpha } from '../../components/ui/designTokensStatic';

export const BUBBLE_TAIL_W = 8;

export const createStyles = (tokens: any) => {
  const isDarkMode = (tokens.colors.background.primary as string) !== LIGHT_CANVAS;
  return StyleSheet.create({
  /* מרווחים בסגנון WhatsApp: צפיפות בין הודעות אותו שולח;
     מרווח גדול מול older בהחלפת שולח — senderGapStyle.marginTop (isAfterSenderChange) */
  messageContainer: {
    flexDirection: 'row',
    paddingHorizontal: 0,
    alignItems: 'flex-end',
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  theirMessage: {
    justifyContent: 'flex-start',
  },
  highlightOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: tokens.colors.primary.subtle,
    borderRadius: tokens.borderRadius.md,
  },

  avatarContainer: {
    marginRight: 6,
    marginBottom: 2,
  },
  avatarSpacer: {
    width: 26,
    height: 26,
    marginRight: 6,
    marginBottom: 2,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarPlaceholder: {
    backgroundColor: tokens.colors.border.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: tokens.colors.text.primary,
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.semibold,
  },

  /** עוטף GestureDetector — View נייטיבי; יישור כמו messageContent */
  gestureSwipeWrapper: {
    maxWidth: '80%',
    minWidth: 0,
  },
  // מקום לשפיץ (BUBBLE_TAIL_W) — לכל הבועות בצד, כדי שרצף יישאר מיושר
  gestureSwipeWrapperMe: {
    alignSelf: 'flex-end',
    marginRight: BUBBLE_TAIL_W - 2,
  },
  // הכרזות: במרכז, כמעט ברוחב מלא (כמו וואטסאפ)
  centeredMessage: {
    justifyContent: 'center',
  },
  gestureSwipeWrapperCentered: {
    alignSelf: 'center',
    width: '94%',
    maxWidth: '94%',
  },
  centeredStretch: {
    alignItems: 'stretch',
  },
  reactionsAndComments: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    gap: 6,
  },
  // כמו בועת הריאקשנים (MessageReactions): גובה 22, רדיוס 11, מרווח 4 מהבועה
  commentsRow: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  commentsPill: {
    minHeight: 22,
    borderRadius: 11,
  },
  // אותן מידות בדיוק כמו pillContent / count ב-MessageReactions
  commentsPillContent: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 1,
  },
  // כמו האימוג'י בריאקשן (13px, שורה 16)
  commentsIcon: {
    lineHeight: 16,
    paddingHorizontal: 1,
  },
  commentsCount: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 1,
    minWidth: 8,
    textAlign: 'center',
  },
  centeredBubble: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  gestureSwipeWrapperThem: {
    alignSelf: 'flex-start',
    marginLeft: BUBBLE_TAIL_W - 2,
  },
  /** אודיו: בועה רחבה יחסית — כמו לפני ה־narrow polish */
  gestureSwipeWrapperAudio: {
    maxWidth: '78%',
    minWidth: 210,
  },
  /** סקר: מונע התכווצות לרוחב אות בודדת אחרי הסרת כותרת האייקון */
  /** שיתוף דוח / דיווח כלכלי — בועה ברוחב קבוע 92% */
  gestureSwipeWrapperWideEntity: {
    width: '92%',
    maxWidth: '92%',
  },
  /** שרשרת העוטפים של בועת דוח / דיווח ממלאת את ה-92% — הכרטיס מתמתח פנימה, בלי רוחב מחושב שגלש */
  wideEntityStretch: {
    alignSelf: 'stretch',
    maxWidth: '100%',
  },
  gestureSwipeWrapperPoll: {
    maxWidth: '80%',
    minWidth: 220,
  },
  messageContent: {
    maxWidth: '100%',
    alignItems: 'flex-start',
  },
  messageContentMe: {
    alignItems: 'flex-end',
  },
  audioMessageContent: {
    minWidth: 200,
    maxWidth: 280,
    width: '100%',
    alignSelf: 'stretch',
  },
  pollMessageContent: {
    minWidth: 220,
    maxWidth: 280,
    width: '100%',
    alignSelf: 'stretch',
  },
  bubbleStack: {
    maxWidth: '100%',
    alignItems: 'flex-start',
  },
  bubbleStackMe: {
    alignItems: 'flex-end',
  },

  // שם השולח בבועת other: שורה אחת שתורמת לרוחב הבועה (לא width:100% — זה מתווכח עם רוחב התוכן),
  // צמוד לימין, עם נשימה קטנה מעל הטקסט
  senderNameTouch: {
    alignSelf: 'stretch',
  },
  centeredSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  centeredSenderAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  // שורת שם + תגים; ריפוד המדיה עבר מהטקסט לשורה
  senderNameRow: {
    marginBottom: 3,
  },
  senderNameRowMedia: {
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 6,
    marginBottom: 3,
  },
  senderNameInRow: {
    marginBottom: 0,
    flexShrink: 1,
  },
  // שם השולח קטן מהטקסט (13 מול 15) — כותרת קטנה בצבע, לא מתחרה בהודעה; lineHeight מלא
  senderNameInside: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    fontWeight: '600',
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    marginTop: 0,
    marginBottom: 3,
    direction: ROOT_DIR,
    textAlign: 'right',
    writingDirection: 'auto',
  },

  replyContainer: {
    flexDirection: 'row-reverse',
    borderRadius: 8,
    padding: 10,
    paddingRight: 6,
    marginBottom: 6,
    marginTop: 2,
    overflow: 'visible',
    borderWidth: 0,
    minHeight: 50,
  },
  // בלייט שחור שקוף על הבועה הירוקה יוצא אפור-ירקרק כהה — שם לבן שקוף (ובבועת הצד השני אפור עדין)
  replyContainerMe: {
    backgroundColor: isDarkMode ? blackAlpha(0.2) : whiteAlpha(0.55),
  },
  replyContainerThem: {
    backgroundColor: isDarkMode ? whiteAlpha(0.15) : blackAlpha(0.045),
  },
  replyBar: {
    width: 3,
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 1.5,
    marginLeft: 8,
    flexShrink: 0,
    minHeight: 24,
  },
  replyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  replyName: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.primary.main,
    marginBottom: 3,
    textAlign: 'right',
  },
  replyText: {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.text.secondary,
    opacity: 0.9,
  },

  // קצב אנכי: ריפוד 7/6, שם→טקסט 3, טקסט→שעה 3 (קודם 5/5, 2, 1 — הכל נצמד)
  bubble: {
    borderRadius: 16,
    paddingTop: 7,
    paddingBottom: 6,
    paddingHorizontal: 10,
    maxWidth: '100%',
  },
  /** כשיש ריפליי — גוף ההודעה מתחת לרצועת הריפליי */
  bubbleBodyTouchable: {
    alignSelf: 'stretch',
  },
  // top/bottom מפורשים — paddingTop של bubble גובר על paddingVertical
  mediaBubble: {
    paddingTop: tokens.spacing.xs,
    paddingBottom: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.xs,
  },
  pollBubble: {
    minWidth: 220,
    alignSelf: 'stretch',
    // ריפוד כמו בועת טקסט רגילה (יורש מ-bubble) — לא mediaBubble (xs) שמצמיד שאלה/שם לקצה
  },
  myBubble: {
    backgroundColor: tokens.colors.bubbleMe,
    borderBottomRightRadius: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    shadowColor: isDarkMode ? '#000' : 'transparent',
    shadowOffset: isDarkMode ? { width: 0, height: 1 } : { width: 0, height: 0 },
    shadowOpacity: isDarkMode ? 0.18 : 0,
    shadowRadius: isDarkMode ? 3 : 0,
    elevation: isDarkMode ? 2 : 0,
  },
  // ההודעה האחרונה ברצף — פינה תחתונה קצת פחות מעוגלת (בלי שפיץ שבולט לקצה המסך,
  // כך שכל הבועות באותו מרחק מהקצה)
  myBubbleTail: {
    borderBottomRightRadius: 6,
  },
  theirBubbleTail: {
    borderBottomLeftRadius: 6,
  },
  theirBubble: {
    backgroundColor: tokens.colors.bubbleOther,
    borderBottomLeftRadius: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: isDarkMode ? '#000' : 'transparent',
    shadowOffset: isDarkMode ? { width: 0, height: 1 } : { width: 0, height: 0 },
    shadowOpacity: isDarkMode ? 0.14 : 0,
    shadowRadius: isDarkMode ? 3 : 0,
    elevation: isDarkMode ? 2 : 0,
  },
  deletedRow: {
    direction: UI_DIR,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deletedIcon: {
    opacity: 0.85,
  },

  forwardedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  forwardedText: {
    fontSize: tokens.typography.fontSize.xs,
    fontStyle: 'italic',
    color: tokens.colors.text.secondary,
    opacity: 0.7,
  },

  mediaImage: {
    width: '100%',
    maxWidth: 220,
    // aspectRatio set dynamically from media dimensions
    borderRadius: tokens.borderRadius.md,
    marginBottom: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  mediaWide: {
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  mediaImagePlaceholder: {
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 4,
    backgroundColor: tokens.colors.background.overlay,
    borderRadius: tokens.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadProgress: {
    color: tokens.colors.text.primary,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.semibold,
    marginTop: 8,
  },
  mediaVideo: {
    position: 'relative',
    width: '100%',
    maxWidth: 220,
    aspectRatio: 0.9,
    borderRadius: tokens.borderRadius.md,
    marginBottom: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.background.tertiary,
  },
  mediaVideoFrame: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /* WhatsApp-style timestamp overlay on images/videos */
  imageTimeOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: blackAlpha(0.48),
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  imageTimeText: {
    color: whiteAlpha(0.93),
    fontSize: 11,
    fontWeight: '500',
    writingDirection: 'ltr',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: blackAlpha(0.12),
  },
  playButtonContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.colors.background.cardSolid,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  videoBottomBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  videoDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: blackAlpha(0.45),
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  videoDurationText: {
    color: whiteAlpha(0.93),
    fontSize: 11,
    fontWeight: '500',
    writingDirection: 'ltr',
  },
  playIcon: {
    fontSize: 24,
  },

  mediaAudio: {
    flexDirection: 'column',
    direction: ROOT_DIR,
    alignSelf: 'stretch',
    width: '100%',
    // קצת רחב יותר — מרווח בין הכפתור, הוויבפורם והתמונה
    maxWidth: 300,
    minWidth: 230,
    // בלי ריפוד נוסף — הכפתור והוויבפורם מיושרים לשם ולקצה הבועה כמו בשאר ההודעות
    paddingVertical: 0,
    paddingHorizontal: 0,
    gap: 0,
    backgroundColor: 'transparent',
  },
  audioMetadataMerged: {
    width: '100%',
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  audioMetadataLeft: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
    flexShrink: 1,
    minWidth: 0,
  },
  audioMetadataRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    flexShrink: 0,
    marginLeft: 8,
  },
  audioPlaybackTimeText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  audioSentTimeText: {
    textAlign: 'right',
  },
  mediaAudioControlsRow: {
    flexDirection: 'row',
    direction: ROOT_DIR,
    alignItems: 'center',
    width: '100%',
    minHeight: 28,
    gap: 10,
  },
  audioWaveformFlex: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 88,
    justifyContent: 'center',
  },
  audioPlayButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  audioPlayIcon: {
    width: 20,
    height: 20,
    tintColor: tokens.colors.text.primary,
    opacity: 0.9,
  },
  audioWaveformWrapper: {
    width: '100%',
    height: 26,
    flexShrink: 0,
  },
  audioWaveformContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
  },
  audioWaveformClip: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 4,
    justifyContent: 'center',
  },
  audioWaveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
    width: '100%',
    paddingHorizontal: 4,
  },
  audioWaveformBar: {
    width: 2,
    borderRadius: 999,
  },
  audioProgressIndicator: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    top: '50%',
    marginTop: -5,
    zIndex: 2,
    pointerEvents: 'none',
  },
  audioSideSlot: {
    width: 46,
    height: 46,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioSideTimeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  audioSideTime: {
    fontSize: APP_TYPE.caption.fontSize,
    lineHeight: APP_TYPE.caption.lineHeight,
    fontWeight: tokens.typography.fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  audioSideSpeedWrap: {
    position: 'absolute',
    // צמוד לזמן (מרווח ~2px)
    bottom: 3,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  audioSidePlayTimeWrap: {
    position: 'absolute',
    top: 5,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  audioSenderAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  audioSenderAvatarFallback: {
    backgroundColor: tokens.colors.border.hover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioSenderInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.text.primary,
  },
  // מיקרופון קטן בפינה (כמו וואטסאפ)
  audioMicBadge: {
    position: 'absolute',
    bottom: -2,
    left: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.background.primary,
  },

  audioSpeedButton: {
    backgroundColor: tokens.colors.border.hover,
    borderRadius: tokens.borderRadius.full,
    paddingHorizontal: 6,
    height: 20,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  audioSpeedText: {
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
  },
  myAudioTime: {
    color: tokens.colors.text.primary,
    opacity: 0.9,
  },
  theirAudioTime: {
    color: tokens.colors.text.secondary,
  },
  audioDuration: {
    fontSize: tokens.typography.label.size,
    fontWeight: tokens.typography.fontWeight.medium,
    minWidth: 40,
    textAlign: 'left',
  },
  myAudioDuration: {
    color: tokens.colors.text.primary,
  },
  theirAudioDuration: {
    color: tokens.colors.text.primary,
  },

  // Document - פשוט בתוך הבועה הקיימת
  documentCard: {
    direction: UI_DIR,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 180,
    maxWidth: 260,
    paddingVertical: 2,
  },
  documentIconTile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  documentTextContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  documentName: {
    ...appPhysicalRightText,
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    fontWeight: '600',
    writingDirection: 'auto',
  },
  documentSize: {
    ...appPhysicalRightText,
    fontSize: APP_TYPE.caption.fontSize,
    lineHeight: APP_TYPE.caption.lineHeight,
    fontVariant: ['tabular-nums'],
  },
  downloadButton: {
    width: 36,
    height: 36,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.border.hover,
    justifyContent: 'center',
    alignItems: 'center',
  },

  messageText: {
    fontSize: tokens.typography.body.size - 1,
    lineHeight: Math.round((tokens.typography.body.size - 1) * tokens.typography.lineHeight.normal),
    marginTop: 0,
    marginBottom: 0,
    color: tokens.colors.text.primary,
  },
  messageTextBold: {
    fontWeight: '700',
  },
  messageTextWithMedia: {
    marginTop: 8,
    paddingHorizontal: 2,
  },
  // הודעות שלי — טקסט לבן/כהה מלא על בועה ירוקה (לא text.primary גנרי)
  myMessageText: {
    color: tokens.colors.bubbleMeText,
  },
  theirMessageText: {
    color: tokens.colors.text.primary,
  },
  deletedText: {
    fontStyle: 'italic',
    writingDirection: TEXT_DIR,
  },

  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
  },
  editedText: {
    fontStyle: 'italic',
    opacity: 0.7,
  },
  // text-xs text-gray-500
  timeText: {
    fontSize: tokens.typography.fontSize.xs,
    lineHeight: 14,
    opacity: 0.8,
  },
  myTimeText: {
    color: tokens.colors.bubbleMeMetaText,
    opacity: 1,
  },
  theirTimeText: {
    color: tokens.colors.text.tertiary,
  },

  metadataRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  metadataTimeGroup: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  sentTick: {
    opacity: 0.75,
    marginTop: 1,
  },
  starredFooterIcon: {
    opacity: 0.85,
    marginTop: 1,
  },
  starredFooterSpacer: {
    width: 0,
    height: 0,
  },
  retryRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  sendErrorText: {
    fontSize: tokens.typography.fontSize.xs,
    color: '#EF4444',
    fontStyle: 'italic',
  },
  systemMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.md,
  },
  systemMessageLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.border.divider,
  },
  systemMessageText: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.text.tertiary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    textAlign: 'center',
    backgroundColor: tokens.colors.border.divider,
    borderRadius: tokens.borderRadius.lg,
    overflow: 'hidden',
  },
  });
};
