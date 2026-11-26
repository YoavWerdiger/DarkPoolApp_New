/** סגנונות של ChatGroupsListScreen.tsx — הועברו מקובץ המסך (פריט 52, פיצול קבצים ענקיים). */
import { UI_DIR } from '../../lib/i18n/direction';
import { TEXT_DIR, getStoredLanguage, isRtlLanguage } from '../../lib/i18n/language';
import { Text, StyleSheet, I18nManager } from 'react-native';
import { chromeSurfaceFill } from '../../components/ui/chromeControl';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { Search } from 'lucide-react-native';
import { CHAT_LAYOUT, chatSectionTitleStyle } from '../../components/chat/chatLayout';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { APP_TYPE, appPhysicalRightText } from '../../components/ui/appType';

export const HP = APP_LAYOUT.screenPaddingHorizontal;

export const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  container: { flex: 1, backgroundColor: 'transparent' },

  headerEndActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /* ── Raised list card ── */
  listCard: {
    flex: 1,
    backgroundColor: 'transparent',
    borderTopLeftRadius: UI_CARD_RADIUS,
    borderTopRightRadius: UI_CARD_RADIUS,
    marginTop: 6,
    overflow: 'hidden',
  },

  /* ── Stories row ── */
  statusRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    paddingHorizontal: HP,
    paddingTop: 8,
    paddingBottom: 9,
  },
  statusRowScroll: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  statusCircle: { alignItems: 'center' },
  statusStorySlot: { flexDirection: 'row', alignItems: 'flex-start', flexShrink: 0 },
  statusStoryGap: { width: 7, flexShrink: 0 },
  pendingStoryOverlay: {
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusStoryItem: { alignItems: 'center', flexShrink: 0 },
  // לפי הטופו: מילוי כפתורי הכרום (כמו שאר הכפתורים העגולים), לא אפור tertiary
  statusCircleInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: chromeSurfaceFill(tokens),
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusAddOuter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    // קו מקווקו בירוק המותג (primary.main)
    borderWidth: 1.5,
    borderColor: tokens.colors.primary.main,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  // אותו גודל כמו טבעות האחרים (68; הטבעת מוסיפה marginBottom 6 משלה)
  statusOwnRingWrap: {
    width: 68,
  },
  // אותו מיקום כמו בעיגול «הוסף» (bottom:-1 מעל 66) — כאן מעל ה-marginBottom של הטבעת
  statusOwnAddBadge: {
    bottom: 6 - 1,
    right: -1,
  },
  statusAddBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: tokens.colors.background.primary,
  },
  storyAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.border.divider,
  },
  statusLabel: {
    ...APP_TYPE.caption2,
    color: tokens.colors.text.secondary,
    maxWidth: 68,
    textAlign: 'center',
    marginTop: 2,
  },
  statusCircleImage: { width: '100%', height: '100%' },
  chatTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinIcon: {
    transform: [{ rotate: '30deg' }],
  },
  storiesDivider: {
    height: 1,
    backgroundColor: tokens.colors.border.divider,
    marginHorizontal: HP,
    marginTop: 2,
    marginBottom: 4,
  },

  /* ── Search + Filters ── */
  searchSection: {
    paddingHorizontal: HP,
    paddingTop: 10,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: tokens.colors.border.primary,
    borderRadius: tokens.borderRadius.search,
    paddingHorizontal: 16,
    height: 42,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    ...APP_TYPE.body,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
    paddingVertical: 0,
  },
  /* ── Search Sheet ── */
  searchSheetRoot: {
    flex: 1,
    direction: UI_DIR,
    paddingHorizontal: HP,
    gap: 12,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tokens.colors.background.cardSolid,
    borderWidth: 0,
    borderRadius: tokens.borderRadius.search,
    paddingHorizontal: 18,
    height: 46,
  },
  searchPillInput: {
    flex: 1,
    ...APP_TYPE.body,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
    paddingVertical: 0,
  },
  searchSectionHeader: {
    ...APP_TYPE.groupLabel,
    color: tokens.colors.text.secondary,
    ...appPhysicalRightText,
    marginTop: 6,
    marginBottom: APP_LAYOUT.groupLabelToContent,
  },
  searchNoResults: {
    ...APP_TYPE.cardBody,
    color: tokens.colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: APP_LAYOUT.cardPadding,
    writingDirection: TEXT_DIR,
  },
  // בתוך searchSheetRoot (direction rtl): row = תמונה מימין, טקסט משמאל לה
  searchRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
  },
  searchRowAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: tokens.colors.background.tertiary,
  },
  searchRowAvatarPlaceholder: {
    backgroundColor: tokens.colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRowBody: {
    flex: 1,
    minWidth: 0,
  },
  searchRowTitle: {
    ...APP_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    ...appPhysicalRightText,
  },
  searchRowSubtitle: {
    ...APP_TYPE.cardSubtitle,
    color: tokens.colors.text.secondary,
    ...appPhysicalRightText,
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
  },
  searchSenderName: {
    ...APP_TYPE.cardSubtitle,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    color: tokens.colors.text.primary,
  },
  searchRowMsgHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  searchRowTime: {
    ...APP_TYPE.caption2,
    color: tokens.colors.text.tertiary,
  },
  filterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },

  /* ── Chat row ── */
  chatRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: HP,
  },
  avatarWrap: {
    position: 'relative',
    marginLeft: 12,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: tokens.colors.background.tertiary,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatBody: { flex: 1, minWidth: 0 },
  chatRow1: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: APP_LAYOUT.cardTitleToSubtitleGap,
  },
  chatName: {
    ...APP_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    flex: 1,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  chatTime: {
    ...APP_TYPE.caption,
    color: tokens.colors.text.tertiary,
    marginRight: 10,
  },
  chatTimeUnread: { color: tokens.colors.text.primary },
  chatRow2: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatPreview: {
    ...APP_TYPE.cardSubtitle,
    color: tokens.colors.text.secondary,
    flex: 1,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  chatPreviewUnread: {
    color: tokens.colors.text.primary,
  },
  badge: {
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 7,
    marginRight: 10,
  },
  badgeText: { ...APP_TYPE.caption, color: tokens.colors.text.inverse },
  mentionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.colors.text.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  mentionBadgeText: {
    ...APP_TYPE.caption,
    color: tokens.colors.text.primary,
  },
  rowSeparator: {
    height: 1,
    backgroundColor: tokens.colors.border.divider,
    marginHorizontal: HP,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: tokens.colors.border.divider,
    marginHorizontal: HP,
    // בלי רווח מתחת — רקע ההחלקה של השורה הראשונה אחרי ההכרזות נוגע בדיבידר (אותו רווח כולל)
    marginTop: 8,
    marginBottom: 0,
  },

  /* ── Section headers — כותרת סקשן (sectionTitle), מתחת לכותרת המסך ── */
  sectionHeaderRow: {
    paddingHorizontal: HP,
    paddingTop: 16,
    paddingBottom: CHAT_LAYOUT.sectionHeaderToContent,
  },
  sectionHeaderText: {
    ...chatSectionTitleStyle,
    color: tokens.colors.text.primary,
  },
  sectionHeaderDot: {
    color: tokens.colors.text.primary,
  },
  // כותרת הסקשן בשלד: הטקסט האמיתי + צורה במקום המונה
  skeletonHeaderLine: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },

  /* ── Joinable group row ── */
  joinableRow: {},
  createGroupRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingVertical: 15,
  },
  createGroupIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.background.cardSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createGroupText: {
    ...APP_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  joinableAvatar: {},
  joinableSubtitle: {
    ...APP_TYPE.cardSubtitle,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
  },
  joinablePill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 200, 5, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 28,
    marginRight: 4,
    alignSelf: 'center',
  },
  joinablePillText: {
    ...APP_TYPE.caption,
    color: tokens.colors.primary.main,
  },
  premiumPill: {
    // Text then lock in reading order: the layout only flips when RTL is really active (not in Expo Go)
    flexDirection: isRtlLanguage(getStoredLanguage()) === I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#C7950F',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 28,
    marginRight: 4,
    alignSelf: 'center',
  },
  premiumPillText: {
    ...APP_TYPE.caption,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  /* ── Empty state ── */
  emptyListContainer: { flexGrow: 1 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    ...APP_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    marginTop: APP_LAYOUT.cardPadding,
    textAlign: 'center',
    writingDirection: TEXT_DIR,
  },
  emptyText: {
    ...APP_TYPE.cardBody,
    color: tokens.colors.text.secondary,
    marginTop: APP_LAYOUT.stackGapSmall,
    textAlign: 'center',
    writingDirection: TEXT_DIR,
  },

  /* ── Offline banner ── */
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.8)',
    paddingVertical: 6,
    marginHorizontal: HP,
    marginVertical: 4,
    borderRadius: 10,
  },
  offlineBannerText: {
    ...APP_TYPE.footnote,
    color: tokens.colors.text.primary,
  },
});
