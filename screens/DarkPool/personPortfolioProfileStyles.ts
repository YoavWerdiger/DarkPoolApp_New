/** סגנונות של PersonPortfolioProfileScreen.tsx — הועברו מקובץ המסך (פריט 52, פיצול קבצים ענקיים). */
import { ROOT_DIR, UI_DIR } from '../../lib/i18n/direction';
import { Pressable, StyleSheet } from 'react-native';
import { CHANGE_DOT_SIZE } from '../../components/ui/ChangeDot';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { PROFILE_FOLLOW_DOCK_GAP, PROFILE_FOLLOW_DOCK_HPAD, PROFILE_FOLLOW_PILL_HEIGHT } from './utils/profileFollowBar';
import { DARK_POOL_TYPE, darkPoolPhysicalRightText, darkPoolRtlContent, darkPoolSectionTitleStyle } from './darkPoolLayout';

export function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: 'transparent',
      overflow: 'hidden',
      ...darkPoolRtlContent,
    },
    heroBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1,
      elevation: 1,
      // התמונה גדלה למטה במשיכה — לא לחתוך בגובה ה-hero
      overflow: 'visible',
    },
    heroChrome: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
      elevation: 2,
    },
    scroll: {
      direction: UI_DIR,
    },
    body: {
      paddingHorizontal: 16,
      paddingTop: 10,
      direction: UI_DIR,
    },
    errCard: {
      marginBottom: 12,
      borderColor: tokens.colors.border.danger,
    },
    errText: {
      ...darkPoolPhysicalRightText,
      color: tokens.colors.text.danger,
      fontSize: DARK_POOL_TYPE.body.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.body.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      alignSelf: 'stretch',
    },
    valueBlock: {
      marginBottom: APP_LAYOUT.stackGapSmall,
      width: '100%',
      direction: 'ltr',
      alignItems: 'flex-end',
    },
    valueLabelRow: {
      direction: UI_DIR,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: APP_LAYOUT.stackGapSmall,
    },
    valueLabel: {
      ...darkPoolSectionTitleStyle,
      flexShrink: 1,
      width: undefined,
      color: tokens.colors.text.primary,
    },
    valueHelpBtn: {
      padding: 2,
    },
    heroFlowContainer: {
      alignSelf: 'stretch',
      marginTop: APP_LAYOUT.cardMetricLabelToValueGap,
    },
    heroValue: {
      direction: ROOT_DIR,
      writingDirection: 'ltr',
      textAlign: 'right',
      marginTop: APP_LAYOUT.cardMetricLabelToValueGap,
      fontSize: DARK_POOL_TYPE.cardMetricValue.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.cardMetricValue.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardMetricValue.fontWeight,
      letterSpacing: DARK_POOL_TYPE.cardMetricValue.letterSpacing,
      color: tokens.colors.text.primary,
    },
    deltaRow: {
      marginTop: APP_LAYOUT.titleSubtitleGap,
      alignSelf: 'flex-end',
      direction: 'ltr',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    deltaFigure: {
      fontSize: DARK_POOL_TYPE.cardBody.fontSize,
      lineHeight: DARK_POOL_TYPE.cardBody.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      writingDirection: 'ltr',
      fontVariant: ['tabular-nums'],
    },
    deltaDot: {
      width: CHANGE_DOT_SIZE,
      height: CHANGE_DOT_SIZE,
      borderRadius: CHANGE_DOT_SIZE / 2,
    },
    followDock: {
      paddingHorizontal: PROFILE_FOLLOW_DOCK_HPAD,
      paddingTop: PROFILE_FOLLOW_DOCK_GAP,
      zIndex: 20,
      elevation: 12,
    },
    followPill: {
      alignSelf: 'stretch',
      width: '100%',
      overflow: 'hidden',
    },
    followPillInner: {
      height: PROFILE_FOLLOW_PILL_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    followPillText: {
      fontSize: DARK_POOL_TYPE.body.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.body.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      textAlign: 'center',
    },
    chartWatermark: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chartWrap: {
      marginBottom: APP_LAYOUT.sectionGap,
      alignSelf: 'stretch',
    },
    chartCard: {
      marginBottom: APP_LAYOUT.sectionGap,
      borderRadius: UI_CARD_RADIUS,
      overflow: 'hidden',
    },
    sectionTitle: {
      ...darkPoolSectionTitleStyle,
      color: tokens.colors.text.primary,
      marginBottom: APP_LAYOUT.sectionHeaderToContent,
    },
    sectionTitleRow: {
      direction: UI_DIR,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: APP_LAYOUT.stackGapSmall,
      marginBottom: APP_LAYOUT.sectionHeaderToContent,
    },
    // סגנון הכותרת רוחב מלא (100%) — בשורה עם תגית «נכון לרבעון» הוא דחף את התגית אל מחוץ למסך
    sectionTitleInRow: {
      marginBottom: 0,
      marginTop: 0,
      width: undefined,
      flexShrink: 1,
    },
    honestyTag: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.secondary,
    },
    honestyTagInRow: {
      flexShrink: 0,
    },
    rowHonestyTag: {
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.secondary,
    },
    listPanel: {
      marginBottom: APP_LAYOUT.sectionGap,
      borderRadius: UI_CARD_RADIUS,
      overflow: 'hidden',
      alignSelf: 'stretch',
      width: '100%',
    },
    listPanelInner: {
      width: '100%',
      alignSelf: 'stretch',
    },
    leadingIcon: {
      flexShrink: 0,
    },
    iconTickerGap: {
      width: 12,
      flexShrink: 0,
    },
    listRowPress: {
      width: '100%',
      alignSelf: 'stretch',
    },
    listRow: {
      direction: UI_DIR,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      width: '100%',
      paddingVertical: APP_LAYOUT.cardTitleToBodyGap,
      paddingHorizontal: APP_LAYOUT.cardPadding,
      minHeight: 56,
    },
    listRowDivider: {
      // קו מפריד מפורש (לא border על Pressable) — נראה ברור יותר על רקע glass
      height: 1,
      backgroundColor: tokens.colors.border.divider,
      marginHorizontal: APP_LAYOUT.cardPadding,
      alignSelf: 'stretch',
    },
    rowText: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      justifyContent: 'center',
      alignItems: 'stretch',
    },
    tradeTicker: {
      direction: ROOT_DIR,
      textAlign: 'right',
      writingDirection: 'ltr',
      fontSize: DARK_POOL_TYPE.cardBody.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.cardBody.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      includeFontPadding: false,
    },
    rowMeta: {
      ...darkPoolPhysicalRightText,
      marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
      includeFontPadding: false,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.secondary,
    },
    rowMetaVerb: {
      fontWeight: DARK_POOL_TYPE.cardMetricLabel.fontWeight,
    },
    tradeRight: { alignItems: 'stretch', flexShrink: 0 },
    tradeDate: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.secondary,
      fontVariant: ['tabular-nums'],
    },
    muted: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
      fontVariant: ['tabular-nums'],
      lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardSubtitle.fontWeight,
      color: tokens.colors.text.secondary,
    },
  });
}
