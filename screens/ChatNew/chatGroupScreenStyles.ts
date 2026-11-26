/** סגנונות של ChatGroupScreen.tsx — הועברו מקובץ המסך (פריט 52, פיצול קבצים ענקיים). */
import { ROOT_DIR } from '../../lib/i18n/direction';
import { TEXT_DIR } from '../../lib/i18n/language';
import { FlatList, StyleSheet } from 'react-native';
import UICard from '../../components/ui/UICard';
import { DayNavBlurButton } from '../../components/ui/DayNavBlurButton';
import { MAIN_SCREEN_HEADER_HP } from '../../components/ui/MainDrawerScreenHeader';
import { APP_TYPE } from '../../components/ui/appType';
import { LIGHT_CANVAS } from '../../components/ui/designTokensStatic';
import ChatInput from '../../components/chat/ChatInput';
import { APP_LAYOUT } from '../../components/ui/appLayout';

export const HP = 20;
/** גובה אחיד לכפתורי צד ולכרטיס שם הקבוצה */
export const CHAT_GROUP_HEADER_HEIGHT = 44;

export const createChatGroupStyles = (tokens: any) => {
  const isDarkMode = tokens.colors.background.primary !== LIGHT_CANVAS;
  return StyleSheet.create({
  readOnlyBar: {
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
  },
  readOnlyPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  readOnlyText: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    writingDirection: TEXT_DIR,
  },
  /* ── Header — כרטיסי זכוכית אחידים (כפתורים + קבוצה) ── */
  headerOuterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  headerSideMarginStart: {
    marginRight: MAIN_SCREEN_HEADER_HP,
  },
  headerSideMarginEnd: {
    marginLeft: MAIN_SCREEN_HEADER_HP,
  },
  headerGlassOuter: {
    flex: 1,
    minWidth: 0,
    borderRadius: 28,
  },
  headerSideGlass: {
    width: CHAT_GROUP_HEADER_HEIGHT,
    height: CHAT_GROUP_HEADER_HEIGHT,
    borderRadius: CHAT_GROUP_HEADER_HEIGHT / 2,
    flexShrink: 0,
  },
  headerSideGlassInner: {
    width: CHAT_GROUP_HEADER_HEIGHT,
    height: CHAT_GROUP_HEADER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackIconFlip: {
    transform: [{ scaleX: -1 }],
  },
  headerBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    direction: ROOT_DIR,
    paddingHorizontal: 12,
    minHeight: CHAT_GROUP_HEADER_HEIGHT,
    height: CHAT_GROUP_HEADER_HEIGHT,
  },
  headerBarInnerTyping: {
    height: undefined,
    paddingVertical: 6,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: APP_TYPE.cardTitle.fontSize,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    lineHeight: APP_TYPE.cardTitle.lineHeight,
    letterSpacing: APP_TYPE.cardTitle.letterSpacing,
    color: tokens.colors.text.primary,
    textAlign: 'center',
    writingDirection: TEXT_DIR,
    width: '100%',
  },
  headerSubtitle: {
    fontSize: 11,
    color: tokens.colors.text.tertiary,
    marginTop: 0,
    textAlign: 'center',
    width: '100%',
    lineHeight: 14,
  },
  /* ── Connection banner ── */
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.85)',
    paddingVertical: 6,
    marginHorizontal: HP,
    marginVertical: 4,
    borderRadius: 10,
  },
  connectionBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  screenRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  messagesKeyboardAvoid: {
    flex: 1,
    minHeight: 0,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  messagesSection: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  /** minHeight:0 — בלי זה FlatList לא מגלגל בתוך עמודת flex */
  messagesAreaFlex: {
    flex: 1,
    minHeight: 0,
    // הרשימה זזה ב-translateY עם המקלדת; clip מונע דליפה מעל ה-PinnedHeader.
    overflow: 'hidden',
  },
  flatListTransparent: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 10,
    paddingVertical: 0,
  },

  /* ── Date divider ── */
  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 8,
  },
  dateDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.border.divider,
  },
  dateDividerBadge: {
    backgroundColor: tokens.colors.background.tertiary,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    marginHorizontal: 10,
  },
  dateDividerText: {
    fontSize: 12,
    fontWeight: '500',
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },

  /* ── Empty state ── */
  emptyList: { flex: 1 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.colors.text.primary,
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 15,
    color: tokens.colors.text.secondary,
  },

  /* ── Typing indicator (mid size between original and shrunk) ── */
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 5,
    // Lift the bubble clearly higher, away from the composer.
    marginBottom: 17,
    gap: 7,
  },
  typingAvatarStack: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  typingAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  typingAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Overlap subsequent avatars when several people type at once.
  typingAvatarStacked: {
    marginStart: -12,
  },
  // Ring around stacked avatars so overlapping ones stay visually separated.
  typingAvatarRing: {
    borderWidth: 1.75,
    borderColor: tokens.colors.background.primary,
  },
  // Solid incoming bubble (bubbleOther). Notch at the bottom-leading corner.
  typingBubble: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.bubbleOther,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 2,
    shadowColor: isDarkMode ? '#000' : 'transparent',
    shadowOffset: isDarkMode ? { width: 0, height: 1 } : { width: 0, height: 0 },
    shadowOpacity: isDarkMode ? 0.14 : 0,
    shadowRadius: isDarkMode ? 3 : 0,
    elevation: isDarkMode ? 2 : 0,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 3.5,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.text.secondary,
  },

  /* ── Input area ── */
  inputArea: {
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },

  /* ── Scroll to bottom FAB ── */
  messagesPlaceholderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  messagesSkeleton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    justifyContent: 'flex-end',
  },
  scrollFabAbsolute: {
    position: 'absolute',
    right: 12,
    zIndex: 9999,
    elevation: 30,
    width: 32,
    height: 32,
  },
  // Clip קשיח כמו DayNavBlurButton — BlurView נשאר עיגול מלא.
  scrollFabClip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    flexShrink: 0,
  },
  // UICard glass/light — אותו מתכון כמו ChatInput / כפתורי הכותרת.
  scrollFabCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  scrollFabInner: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: tokens.colors.primary.main,
    borderWidth: 1.5,
    borderColor: tokens.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    zIndex: 2,
    elevation: 4,
  },
  scrollBadgeText: {
    color: tokens.colors.text.inverse,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* ── Loading ── */
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: tokens.colors.text.secondary,
  },
  loadingFooter: {
    padding: 16,
    alignItems: 'center',
  },

});
};
