/** סגנונות של LearningScreen.tsx — הועברו מקובץ המסך (פריט 52, פיצול קבצים ענקיים). */
import { ROOT_DIR, UI_DIR } from '../../lib/i18n/direction';
import { TEXT_DIR } from '../../lib/i18n/language';
import { StyleSheet, Platform } from 'react-native';
import { ACADEMY_CARD_HP, ACADEMY_CARD_RADIUS } from '../../components/learning/academyCardLayout';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { appGroupLabelStyle } from '../../components/ui/appType';
import { ACADEMY_TYPE, academySectionTitleStyle } from '../../components/learning/academyLayout';
import { DAY_NAV_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import StaticDesignTokens from '../../components/ui/DesignTokens';
import { whiteAlpha } from '../../components/ui/designTokensStatic';

export const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },
  courseListScroll: {
    flexGrow: 1,
  },
  courseListBody: {
    paddingHorizontal: ACADEMY_CARD_HP,
    paddingTop: tokens.spacing.lg,
  },
  courseHeroCover: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  courseHeroImage: {
    width: '100%',
    height: '100%',
  },
  courseHeroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '72%',
  },
  courseHeroText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.xs,
  },
  courseHeroProgress: {
    width: '100%',
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  courseHeroTitle: {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: '800' as const,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.fontSize['2xl'] * 1.2),
    writingDirection: TEXT_DIR,
    textShadowColor: StaticDesignTokens.colors.overlay,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  courseHeroSubtitle: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: '500' as const,
    color: whiteAlpha(0.82),
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.fontSize.sm * 1.4),
    writingDirection: TEXT_DIR,
  },
  courseCoverPlaceholder: {
    backgroundColor: tokens.colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseCoverPlaceholderIcon: {
    fontSize: 48,
  },
  courseListSectionTitle: {
    ...academySectionTitleStyle,
    color: tokens.colors.text.primary,
    marginBottom: APP_LAYOUT.sectionHeaderToContent,
  },
  // Background Gradient
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  
  // Lesson Page Styles - הרקע מגיע מהגרדיאנט
  lessonContainer: {
    flex: 1,
  },
  safeAreaContent: {
    flex: 1,
  },
  courseLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // New Lesson Header Styles - Glassmorphism שקוף
  newLessonHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
    backgroundColor: tokens.colors.background.cardSolid,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border.primary,
    minHeight: 88,
    gap: tokens.spacing.md,
  },
  newBackButton: {
    width: 44,
    height: 44,
    borderRadius: tokens.borderRadius.full,
    backgroundColor: tokens.colors.background.secondary,
    borderWidth: 1,
    borderColor: tokens.colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newHeaderContent: {
    flex: 1,
    alignItems: 'flex-end',
    minWidth: 0,
  },
  newLessonNumber: {
    fontSize: tokens.typography.label.size,
    fontWeight: tokens.typography.label.weight as any,
    letterSpacing: tokens.typography.label.letterSpacing,
    color: tokens.colors.primary.main,
    marginBottom: 2,
  },
  newLessonTitle: {
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.titleSmall.weight as any,
    letterSpacing: tokens.typography.titleSmall.letterSpacing,
    color: tokens.colors.text.primary,
    lineHeight: tokens.typography.titleSmall.size * tokens.typography.lineHeight.normal,
    textAlign: 'right',
  },
  lessonCardTextCol: {
    width: '100%',
    alignItems: 'stretch',
  },
  lessonCardTitle: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.titleXs.size * 1.35),
    letterSpacing: 0.15,
    writingDirection: TEXT_DIR,
  },
  lessonDuration: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
  },
  menuButton: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.border.primary,
  },
  lessonMainContent: {
    flex: 1,
  },
  lessonNotesSection: {
    width: '100%',
  },
  lessonNotesLabel: {
    ...appGroupLabelStyle,
    color: tokens.colors.text.secondary,
  },
  lessonNotesInput: {
    ...ACADEMY_TYPE.body,
    // גובה קבוע: טקסט ארוך נגלל בתוך השדה במקום להאריך את הדף
    height: 180,
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingTop: APP_LAYOUT.cardPadding,
    paddingBottom: APP_LAYOUT.cardPadding,
    writingDirection: TEXT_DIR,
  },
  lessonNotesHint: {
    ...ACADEMY_TYPE.caption,
    marginTop: tokens.spacing.sm,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  lessonGlassCard: {
    borderRadius: ACADEMY_CARD_RADIUS,
    overflow: 'hidden',
  },
  lessonVideoCard: {
    borderRadius: ACADEMY_CARD_RADIUS,
    backgroundColor: '#000',
    overflow: 'hidden',
    position: 'relative',
  },
  lessonPlayerIndex: {
    ...ACADEMY_TYPE.cardSubtitle,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    marginBottom: 0,
    writingDirection: TEXT_DIR,
  },
  // שורת התגית — צמודה לתחילת השורה (ימין בעברית) בעץ פיזי
  lessonPlayerIndexRow: {
    direction: ROOT_DIR,
    alignItems: 'flex-end',
    marginBottom: APP_LAYOUT.stackGapSmall,
  },
  lessonPlayerTitle: {
    ...ACADEMY_TYPE.cardTitle,
    marginTop: 0,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  videoPlayerPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  contentSection: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    paddingHorizontal: ACADEMY_CARD_HP,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing['5xl'],
    // מרווח אחיד בין כל הכרטיסים בדף השיעור
    gap: APP_LAYOUT.cardStackGap,
  },
  lessonPlayerProgressBlock: {
    width: '100%',
    marginTop: APP_LAYOUT.cardTitleToBodyGap,
    gap: tokens.spacing.sm,
  },
  lessonPlayerProgressBlockCompact: {
    marginTop: APP_LAYOUT.stackGapSmall,
  },
  lessonNavShell: {
    borderRadius: tokens.borderRadius.full,
    overflow: 'hidden',
  },
  lessonNavRowStandard: {
    flexDirection: 'row',
    direction: ROOT_DIR,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lessonNavCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  lessonNavCenterTitle: {
    ...ACADEMY_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    textAlign: 'center',
    writingDirection: TEXT_DIR,
  },
  lessonNavCenterSub: {
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
    ...ACADEMY_TYPE.caption,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    writingDirection: TEXT_DIR,
  },
  notesSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: APP_LAYOUT.cardPadding,
  },
  notesSettingsTextCol: {
    flex: 1,
  },
  notesSettingsTitle: {
    ...ACADEMY_TYPE.cardTitle,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  notesSettingsSubtitle: {
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
    ...ACADEMY_TYPE.footnote,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  notesSettingsIcon: {
    width: 36,
    height: 36,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.background.navChrome,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  
  // Lesson Info Card - Glassmorphism
  lessonInfoCard: {
    backgroundColor: tokens.colors.background.cardSolid,
    borderRadius: tokens.borderRadius.lg,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
  },
  lessonInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  lessonInfoLeft: {
    flex: 1,
    marginRight: 16,
  },
  lessonInfoTitle: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.fontSize.xl * tokens.typography.lineHeight.normal),
    writingDirection: TEXT_DIR,
  },
  lessonInfoDescription: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    lineHeight: tokens.typography.body.lineHeight,
    writingDirection: TEXT_DIR,
  },
  lessonInfoRight: {
    alignItems: 'flex-end',
  },
  lessonStats: {
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
  },
  
  // Progress Cards
  progressCards: {
    gap: 16,
    marginBottom: 24,
  },
  progressCard: {
    backgroundColor: tokens.colors.background.cardSolid,
    borderRadius: tokens.borderRadius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
  },
  progressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressCardTitle: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    flex: 1,
    marginRight: 12,
  },
  progressCardPercentage: {
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.primary.main,
    textAlign: 'right',
  },
  progressCardBar: {
    height: 8,
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressCardFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 4,
  },
  progressCardTime: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
  },
  
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: tokens.colors.primary.main,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: tokens.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionButtonText: {
    color: tokens.colors.text.primary,
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    textAlign: 'right',
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: tokens.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionButtonText: {
    color: tokens.colors.primary.main,
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    textAlign: 'right',
  },
  
  // Navigation Buttons
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  navButton: {
    flex: 1,
    backgroundColor: tokens.colors.background.cardSolid,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navButtonText: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.fontWeight.medium as any,
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  
  // Notes Card - Glassmorphism
  notesCard: {
    backgroundColor: tokens.colors.background.cardSolid,
    borderRadius: tokens.borderRadius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
  },
  notesCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  notesCardTitle: {
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.titleSmall.weight as any,
    letterSpacing: tokens.typography.titleSmall.letterSpacing,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    flex: 1,
    marginRight: 12,
  },
  notesCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  notesActionButton: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.background.tertiary,
  },
  notesInput: {
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: tokens.borderRadius.md,
    padding: 16,
    marginBottom: 12,
    minHeight: 100,
  },
  notesTextInput: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.primary,
    textAlignVertical: 'top',
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: 'right',
  },
  notesHint: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.tertiary,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  
  // Simple Lesson Page Styles - Glassmorphism
  simpleLessonInfo: {
    backgroundColor: tokens.colors.background.cardSolid,
    borderRadius: tokens.borderRadius.lg,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
  },
  simpleLessonDescription: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.body.size * 1.45),
    writingDirection: TEXT_DIR,
    width: '100%',
  },
  simpleNotesSection: {
    backgroundColor: tokens.colors.background.cardSolid,
    borderRadius: tokens.borderRadius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
  },
  simpleNotesHeader: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    marginBottom: tokens.spacing.xs,
  },
  simpleNotesHeaderIconsRow: {
    zIndex: 2,
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.xs,
  },
  simpleNotesTitleOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 80,
    zIndex: 0,
  },
  simpleNotesTitle: {
    width: '100%',
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    color: tokens.colors.text.primary,
    textAlign: 'center',
    writingDirection: TEXT_DIR,
  },
  simpleNotesInput: {
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: tokens.borderRadius.md,
    padding: 16,
    minHeight: 100,
  },
  simpleNotesTextInput: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.primary,
    textAlignVertical: 'top',
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: 'right',
  },
  notesPreview: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    fontStyle: 'italic',
    width: '100%',
    lineHeight: Math.round(tokens.typography.bodySmall.size * 1.4),
    writingDirection: TEXT_DIR,
  },

  notesSheetContent: {
    flex: 1,
    backgroundColor: 'transparent',
    direction: UI_DIR,
  },
  notesSheetHeader: {
    flexDirection: 'row',
    direction: ROOT_DIR,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: 16,
    minHeight: DAY_NAV_BUTTON_SIZE,
  },
  notesSheetTitleWrap: {
    position: 'absolute',
    left: tokens.spacing.lg + DAY_NAV_BUTTON_SIZE,
    right: tokens.spacing.lg + DAY_NAV_BUTTON_SIZE,
    top: 0,
    bottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesSheetHeaderTitle: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.42,
    textAlign: 'center',
    writingDirection: TEXT_DIR,
  },
  notesSheetScroll: {
    flex: 1,
  },
  notesSheetScrollContent: {
    flexGrow: 1,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: 14,
    gap: 12,
    direction: UI_DIR,
  },
  notesSheetInputShell: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  notesSheetInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...ACADEMY_TYPE.body,
    direction: ROOT_DIR,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
    textAlignVertical: 'top',
    minHeight: 220,
    width: '100%',
    paddingVertical: 4,
  },
  notesSheetHint: {
    ...ACADEMY_TYPE.caption,
    textAlign: 'center',
    writingDirection: TEXT_DIR,
    width: '100%',
  },
  notesSheetFooter: {
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: APP_LAYOUT.cardStackGap,
    backgroundColor: 'transparent',
  },
  notesSheetSavePrimary: {
    height: 50,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary.main,
  },
  notesSheetSavePrimaryDisabled: {
    opacity: 0.65,
  },
  notesSheetSavePrimaryContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  notesSheetSavePrimaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.text.inverse,
  },
  
  // Bottom Sheet Styles
  bottomSheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.colors.backdrop,
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: tokens.colors.background.cardSolid,
    borderTopLeftRadius: tokens.borderRadius.xl,
    borderTopRightRadius: tokens.borderRadius.xl,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderColor: tokens.colors.border.primary,
    minHeight: '60%',
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border.primary,
    minHeight: 60,
  },
  dragHandle: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    backgroundColor: tokens.colors.text.tertiary,
    borderRadius: 2,
    alignSelf: 'center',
  },
  bottomSheetTitle: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: 24,
    textAlignVertical: 'center',
    flex: 1,
    includeFontPadding: false,
  },
  closeButton: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.border.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border.primary,
    gap: 12,
    minHeight: 60,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  toolbarButton: {
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.border.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesInputContainer: {
    flex: 1,
    padding: 20,
  },
  textInputWrapper: {
    flex: 1,
  },
  notesTextArea: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.primary,
    textAlignVertical: 'top',
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: 'right',
    minHeight: 200,
  },
  bottomSheetActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.background.tertiary,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    color: tokens.colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.primary.main,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    color: tokens.colors.text.primary,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: tokens.colors.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: tokens.colors.background.cardSolid,
    borderRadius: tokens.borderRadius.lg,
    padding: 20,
    width: '80%',
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.fontWeight.bold as any,
    letterSpacing: tokens.typography.titleSmall.letterSpacing,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: tokens.borderRadius.sm,
    padding: tokens.spacing.md,
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: 20,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.background.tertiary,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: tokens.colors.primary.main,
  },
  modalButtonText: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    color: tokens.colors.text.secondary,
  },
  modalButtonTextPrimary: {
    color: tokens.colors.text.primary,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: tokens.borderRadius.full,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderWidth: 3,
  },
  
  // Rich Text Editor Styles
  richTextContainer: {
    flex: 1,
    padding: 16,
  },
  richTextContent: {
    paddingBottom: 20,
  },
  richTextElement: {
    fontSize: tokens.typography.body.size,
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.primary,
    marginBottom: 8,
    textAlign: 'right',
  },
  boldText: {
    fontWeight: 'bold',
  },
  richImageElement: {
    borderRadius: tokens.borderRadius.sm,
    marginVertical: 8,
    alignSelf: 'center',
  },
  linkText: {
    color: tokens.colors.primary.main,
    textDecorationLine: 'underline',
  },
  datetimeText: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.bodySmall.size,
    fontStyle: 'italic',
  },
  listText: {
    marginLeft: 16,
  },
  placeholderText: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.tertiary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 40,
  },
  activeToolbarButton: {
    backgroundColor: tokens.colors.primary.main + '20',
  },
  
  // Text Input Styles
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.primary,
    backgroundColor: tokens.colors.background.tertiary,
  },
  textInput: {
    flex: 1,
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: tokens.borderRadius['3xl'],
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    maxHeight: 100,
    marginRight: 8,
  },
  addTextButton: {
    width: 40,
    height: 40,
    borderRadius: tokens.borderRadius.full,
    backgroundColor: tokens.colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  elementContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  deleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: tokens.borderRadius.md,
    padding: 2,
  },
  
  // Flowing Text Styles
  flowingTextContainer: {
    flex: 1,
    padding: 16,
  },
  flowingTextContent: {
    paddingBottom: 20,
  },
  flowingText: {
    fontSize: tokens.typography.body.size,
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 4,
  },
  flowingImage: {
    borderRadius: tokens.borderRadius.sm,
    marginVertical: 8,
    alignSelf: 'center',
  },
  flowingElementContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  
  // Direct Text Editor Styles
  editableTextArea: {
    flex: 1,
    minHeight: 200,
    padding: 16,
  },
  inlineTextInput: {
    flex: 1,
    fontSize: tokens.typography.body.size,
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    textAlignVertical: 'top',
    minHeight: 200,
  },
  newTextInputContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.primary,
  },
  addNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: tokens.borderRadius.sm,
    marginTop: 16,
  },
  addNoteText: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.primary.main,
    marginLeft: 8,
    fontWeight: '500',
  },
  textAreaContent: {
    flex: 1,
    minHeight: 200,
  },
  
  // Header Content Styles
  headerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  savingText: {
    fontSize: tokens.typography.caption.size,
    color: tokens.colors.primary.main,
    marginLeft: 4,
  },
  
  // Notes-like Styles
  notesLikeContainer: {
    flex: 1,
  },
  notesText: {
    fontSize: tokens.typography.body.size,
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 4,
  },
  notesImage: {
    borderRadius: tokens.borderRadius.sm,
    marginVertical: 8,
    alignSelf: 'center',
  },
  formatIndicator: {
    marginTop: 4,
  },
  formatText: {
    fontSize: tokens.typography.caption.size,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  
  // Lesson Progress Info
  lessonProgressInfo: {
    marginTop: 0,
    width: '100%',
    paddingTop: APP_LAYOUT.cardTitleToBodyGap,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.divider,
  },
  lessonProgressInfoNoDescription: {
    paddingTop: 0,
    borderTopWidth: 0,
  },
  progressTimeRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTimeText: {
    ...ACADEMY_TYPE.caption,
    color: tokens.colors.text.secondary,
  },
  progressPercentageText: {
    ...ACADEMY_TYPE.caption,
    color: tokens.colors.text.primary,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 0,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 3,
  },
  completedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // ירוק המותג (primary) — success בלייט הוא ירוק אמרלד אחר (#10B981) שלא תואם לערכה
  completedText: {
    ...ACADEMY_TYPE.caption,
    color: tokens.colors.primary.main,
  },
  
  // Course Header - שקוף עם הגרדיאנט מאחורה
  courseHeader: {
    padding: 0,
    backgroundColor: 'transparent',
  },
  courseImageContainer: {
    position: 'relative',
    marginBottom: 0,
    overflow: 'hidden',
  },
  courseImage: {
    width: '100%',
    height: 220,
    borderRadius: 0,
  },
  courseGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: tokens.colors.background.primary,
  },
  priceContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: tokens.colors.overlay,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  originalPrice: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  currentPrice: {
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.success.main,
  },
  
  courseInfo: {
    gap: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.xl,
    paddingBottom: tokens.spacing.lg,
  },
  courseTitleBlock: {
    gap: tokens.spacing.xs,
    width: '100%',
  },
  courseTitle: {
    fontSize: tokens.typography.displaySmall.size,
    fontWeight: tokens.typography.displaySmall.weight as any,
    letterSpacing: tokens.typography.displaySmall.letterSpacing,
    color: tokens.colors.text.primary,
    lineHeight: Math.round(tokens.typography.displaySmall.size * 1.22),
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  courseSubtitle: {
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.fontWeight.medium as any,
    letterSpacing: tokens.typography.titleSmall.letterSpacing,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.titleSmall.size * 1.35),
    writingDirection: TEXT_DIR,
  },
  courseDescription: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.tertiary,
    lineHeight: Math.round(tokens.typography.body.size * 1.5),
    textAlign: 'right',
    writingDirection: TEXT_DIR,
    width: '100%',
    alignSelf: 'stretch',
  },
  
  // Rating
  ratingContainer: {
    marginTop: 8,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    color: tokens.colors.text.primary,
  },
  ratingCount: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.tertiary,
  },
  
  instructorRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  instructorRatingText: {
    fontSize: tokens.typography.bodySmall.size,
    fontWeight: tokens.typography.fontWeight.medium as any,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  instructorStudents: {
    fontSize: tokens.typography.caption.size,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
  },
  
  // Meta
  courseMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    marginTop: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaValue: {
    fontSize: tokens.typography.bodySmall.size,
    fontWeight: tokens.typography.fontWeight.medium as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  metaLabel: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  
  // Lessons Section
  lessonsSection: {
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },
  
  // Chapter Sections
  chapterSection: {
    marginBottom: tokens.spacing.xl,
  },
  chapterHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: APP_LAYOUT.cardStackGap,
    // מרווח מכותרת הפרק לשיעור הראשון
    marginBottom: APP_LAYOUT.groupLabelToContent + 6,
  },
  chapterHeaderTitle: {
    flex: 1,
    ...ACADEMY_TYPE.groupLabel,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  chapterHeaderBadge: {
    minWidth: 56,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterHeaderBadgeText: {
    ...ACADEMY_TYPE.caption,
  },
  progressContainer: {
    alignItems: 'stretch',
    gap: tokens.spacing.sm,
    minWidth: 132,
    width: 132,
    flexShrink: 0,
  },
  progressTextRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacing.sm,
    minHeight: 22,
  },
  progressText: {
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'right',
    color: tokens.colors.text.secondary,
    lineHeight: Math.round(tokens.typography.fontSize.sm * 1.4),
    writingDirection: TEXT_DIR,
    fontWeight: tokens.typography.fontWeight.medium as any,
  },
  progressTextMuted: {
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'right',
    color: tokens.colors.text.tertiary,
    lineHeight: Math.round(tokens.typography.fontSize.sm * 1.4),
    writingDirection: TEXT_DIR,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: `${tokens.colors.border.primary}99`,
  },
  progressFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 3,
  },
  
  // Lesson Cards
  lessonTouchable: {
    width: '100%',
  },
  lessonThumbnail: {
    position: 'relative',
    height: 132,
    backgroundColor: tokens.colors.background.primary,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    backgroundColor: tokens.colors.background.primary,
  },
  thumbnailGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.colors.backdrop,
  },
  /** מספר שיעור על הבאנר — למעלה שמאל (צד שני ל־badge הזמן למטה־ימין) */
  lessonNumberOnThumb: {
    position: 'absolute',
    top: tokens.spacing.md,
    left: tokens.spacing.md,
    zIndex: 2,
    minWidth: 30,
    height: 28,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: 14,
    backgroundColor: tokens.colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: whiteAlpha(0.35),
    ...tokens.shadows.xs,
  },
  lessonNumberOnThumbText: {
    color: tokens.colors.text.inverse,
    fontWeight: '800' as any,
    fontSize: 14,
    lineHeight: 17,
  },
  durationBadge: {
    position: 'absolute',
    bottom: tokens.spacing.md,
    right: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.sm,
    shadowColor: tokens.shadows.xs.shadowColor,
    shadowOffset: tokens.shadows.xs.shadowOffset,
    shadowOpacity: tokens.shadows.xs.shadowOpacity,
    shadowRadius: tokens.shadows.xs.shadowRadius,
    elevation: tokens.shadows.xs.elevation,
  },
  durationText: {
    fontSize: tokens.typography.caption.size,
    fontWeight: tokens.typography.caption.weight as any,
  },
  completedBadge: {
    position: 'absolute',
    top: tokens.spacing.md,
    right: tokens.spacing.md,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.xs,
    shadowColor: tokens.shadows.xs.shadowColor,
    shadowOffset: tokens.shadows.xs.shadowOffset,
    shadowOpacity: tokens.shadows.xs.shadowOpacity,
    shadowRadius: tokens.shadows.xs.shadowRadius,
    elevation: tokens.shadows.xs.elevation,
  },
  
  lessonContent: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.lg,
    width: '100%',
  },
  lessonInfo: {
    flex: 1,
  },
  lessonDescription: {
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
    ...ACADEMY_TYPE.cardBody,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: TEXT_DIR,
  },
  lessonStatus: {
    marginTop: 2,
  },
  completedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Loading Overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingSpinner: {
    marginBottom: 12,
  },
  loadingText: {
    color: tokens.colors.text.primary,
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.fontWeight.medium as any,
  },
  videoErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.background.secondary,
    minHeight: 200,
    padding: 20,
  },
  videoErrorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  videoErrorText: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.fontWeight.medium as any,
    textAlign: 'center',
    marginBottom: 8,
  },
  videoErrorSubtext: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.typography.bodySmall.size,
    textAlign: 'center',
    marginTop: 8,
  },
  youtubeButton: {
    backgroundColor: tokens.colors.danger.main,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.sm,
    marginTop: 16,
  },
  youtubeButtonText: {
    color: tokens.colors.text.primary,
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
  },
});
