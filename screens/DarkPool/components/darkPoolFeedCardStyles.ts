import { StyleSheet, type ViewStyle } from 'react-native';
import type { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_TYPE } from '../../../components/ui/appType';
import { darkPoolPhysicalRightText } from '../darkPoolLayout';
import { ltrNameText } from '../utils/bidi';

export type DarkPoolFeedCardTokens = ReturnType<typeof useDesignTokens>;

/** כמו גיבור פרטי עסקה — לא 48 של הפיד הישן. */
export const FEED_AVATAR_SIZE = 40;
export const FEED_PERSON_GAP = 10;
export const FEED_NESTED_LOGO = 40;
export const FEED_NESTED_LOGO_RADIUS = FEED_NESTED_LOGO / 2;
/** רדיוס קן פנימי — lg, כמו כרטיס-בתוך-כרטיס ביומן / פרטי עסקה. */
export const FEED_NESTED_RADIUS = 16;
/** רדיוס כרטיס חיצוני — זהה לאקדמיה / UICard. */
export const FEED_OUTER_RADIUS = 24;
/** רווח אנכי בין כרטיסי פיד (לא padding פנימי ולא gutter צד). */
export const FEED_CARD_STACK_GAP = 16;
/** ריפוד פנימי של כרטיס הפיד — APP_LAYOUT.cardPadding (20) */
export const FEED_CARD_INNER_PAD = 20;
/** Gutter אופקי של רשימת «עסקאות אחרונות». */
export const FEED_LIST_GUTTER = 20;
/** כותרת סקשן → שורת צ'יפי סינון. */
export const FEED_LIST_TITLE_TO_CHIPS = 12;
/** צ'יפים → כרטיס פיד ראשון. */
export const FEED_LIST_CHIPS_TO_CARDS = 16;

export const FEED_NESTED_GLASS_INTENSITY = 'light' as const;

/** UICard פנימי — מסגרת 1px על מעטפת `tradeHeroGlassFrameStyle`. */
export const TRADE_HERO_UICARD = {
  variant: 'soft' as const,
  glassIntensity: 'light' as const,
  padding: 'none' as const,
  disableBlur: true as const,
  enableBlur: false as const,
  showGlassBorder: false as const,
} as const;

/** @deprecated alias */
export const FEED_OUTER_UICARD = TRADE_HERO_UICARD;
export const FEED_OUTER_GLASS_INTENSITY = TRADE_HERO_UICARD.glassIntensity;

/** מעטפת עם קו זכוכית — FlatList לא חותך את stroke של UICard. */
export function tradeHeroGlassFrameStyle(
  tokens: DarkPoolFeedCardTokens,
  opts?: { accent?: boolean }
): ViewStyle {
  if (opts?.accent) {
    return {
      borderRadius: tokens.borderRadius.xl,
      borderWidth: 1,
      borderColor: `${tokens.colors.primary.main}40`,
      overflow: 'hidden',
      backgroundColor: `${tokens.colors.primary.main}14`,
    };
  }
  return {
    borderRadius: tokens.borderRadius.xl,
    borderWidth: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  };
}

export function tradeHeroInnerCardStyle(tokens: DarkPoolFeedCardTokens): ViewStyle {
  return {
    borderRadius: tokens.borderRadius.xl,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...tokens.shadows.none,
  };
}

/** קצב כרטיס — APP_TYPE (כותרת→משנה 2px, כותרת→גוף 12px). */
export const FEED_RHYTHM = {
  nameToDates: 2,
  datesToVerb: 4,
  verbToNested: 12,
  metaAfterAction: 2,
  nestedPadV: 8,
  nestedPadH: 8,
  cardPadV: FEED_CARD_INNER_PAD,
  cardPadH: FEED_CARD_INNER_PAD,
} as const;

/**
 * טיפוגרפיית כרטיס פיד / גוף פרטי-עסקה — מיושר ל-APP_TYPE.
 * כותרות סקשן מחוץ לכרטיס לא כאן.
 */
export const FEED_CARD_TYPE = {
  name: APP_TYPE.cardTitle,
  action: { ...APP_TYPE.cardSubtitle, fontWeight: '600' as const },
  dates: APP_TYPE.caption,
  nestedTicker: { ...APP_TYPE.cardSubtitle, fontWeight: '600' as const },
  nestedPrice: { ...APP_TYPE.cardBody, fontWeight: '600' as const },
  nestedLabel: APP_TYPE.caption2,
  nestedSince: { ...APP_TYPE.caption2, fontWeight: '700' as const },
} as const;

/**
 * כרום גיבור פרטי-עסקה — מקור האמת לפיקסלים.
 * הפיד והמסך חולקים את אותם סגנונות כדי שהכרטיס יהיה זהה.
 */
export function createTradeHeroCardStyles(tokens: DarkPoolFeedCardTokens) {
  return StyleSheet.create({
    heroCard: {
      borderRadius: tokens.borderRadius.xl,
      backgroundColor: 'transparent',
      ...tokens.shadows.none,
    },
    heroBody: {
      width: '100%',
      alignSelf: 'stretch',
      gap: FEED_RHYTHM.verbToNested,
    },
    headerRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: FEED_PERSON_GAP,
      width: '100%',
    },
    avatarHit: {
      flexShrink: 0,
    },
    textCol: {
      flex: 1,
      minWidth: 0,
      direction: 'ltr',
      alignItems: 'stretch',
    },
    personName: {
      ...ltrNameText,
      width: '100%',
      fontSize: FEED_CARD_TYPE.name.fontSize,
      lineHeight: FEED_CARD_TYPE.name.lineHeight,
      fontWeight: FEED_CARD_TYPE.name.fontWeight,
      color: tokens.colors.text.primary,
    },
    personHint: {
      ...darkPoolPhysicalRightText,
      width: '100%',
      marginTop: FEED_RHYTHM.nameToDates,
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      fontWeight: FEED_CARD_TYPE.action.fontWeight,
      color: tokens.colors.text.secondary,
    },
    personHintLtr: {
      ...ltrNameText,
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      fontWeight: '500',
      color: tokens.colors.text.secondary,
    },
    action: {
      ...darkPoolPhysicalRightText,
      width: '100%',
      marginTop: FEED_RHYTHM.datesToVerb,
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      fontWeight: FEED_CARD_TYPE.action.fontWeight,
      color: tokens.colors.text.primary,
    },
    actionAfterName: {
      marginTop: FEED_RHYTHM.nameToDates,
    },
    actionVerb: {
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      fontWeight: '700',
    },
    actionRest: {
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      color: tokens.colors.text.secondary,
      fontWeight: '500',
    },
    actionMeta: {
      ...darkPoolPhysicalRightText,
      width: '100%',
      marginTop: FEED_RHYTHM.metaAfterAction,
      fontSize: FEED_CARD_TYPE.dates.fontSize,
      lineHeight: FEED_CARD_TYPE.dates.lineHeight,
      fontWeight: FEED_CARD_TYPE.dates.fontWeight,
      color: tokens.colors.text.secondary,
    },
  });
}

/**
 * מבנה InsiderWave — עברית RTL:
 * דיוקן בימין, שם/תאריכים/פועל באותה עמודה, קן טיקר מקונן (כרטיס-בתוך-כרטיס).
 */
export function createDarkPoolFeedCardStyles(tokens: DarkPoolFeedCardTokens) {
  return StyleSheet.create({
    body: {
      width: '100%',
      alignSelf: 'stretch',
      gap: FEED_RHYTHM.verbToNested,
    },
    headerRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: FEED_PERSON_GAP,
      width: '100%',
    },
    avatarHit: {
      width: FEED_AVATAR_SIZE,
      height: FEED_AVATAR_SIZE,
      flexShrink: 0,
    },
    textCol: {
      flex: 1,
      minWidth: 0,
      direction: 'ltr',
      alignItems: 'stretch',
    },
    nameHit: {
      width: '100%',
      alignSelf: 'stretch',
      padding: 0,
      margin: 0,
    },
    name: {
      ...ltrNameText,
      width: '100%',
      fontSize: FEED_CARD_TYPE.name.fontSize,
      lineHeight: FEED_CARD_TYPE.name.lineHeight,
      fontWeight: FEED_CARD_TYPE.name.fontWeight,
      color: tokens.colors.text.primary,
      includeFontPadding: false,
    },
    dates: {
      ...darkPoolPhysicalRightText,
      width: '100%',
      marginTop: FEED_RHYTHM.nameToDates,
      fontSize: FEED_CARD_TYPE.dates.fontSize,
      lineHeight: FEED_CARD_TYPE.dates.lineHeight,
      fontWeight: FEED_CARD_TYPE.dates.fontWeight,
      color: tokens.colors.text.tertiary,
      includeFontPadding: false,
    },
    action: {
      ...darkPoolPhysicalRightText,
      width: '100%',
      marginTop: FEED_RHYTHM.datesToVerb,
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      fontWeight: FEED_CARD_TYPE.action.fontWeight,
      includeFontPadding: false,
    },
    actionAfterName: {
      marginTop: FEED_RHYTHM.nameToDates,
    },
    actionVerb: {
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      fontWeight: FEED_CARD_TYPE.action.fontWeight,
    },
    nested: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingVertical: FEED_RHYTHM.nestedPadV,
      paddingHorizontal: FEED_RHYTHM.nestedPadH,
      backgroundColor: 'transparent',
    },
    nestedTicker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    nestedLogo: {
      width: FEED_NESTED_LOGO,
      height: FEED_NESTED_LOGO,
      borderRadius: FEED_NESTED_LOGO_RADIUS,
      overflow: 'hidden',
      flexShrink: 0,
    },
    nestedTickerText: {
      fontSize: FEED_CARD_TYPE.nestedTicker.fontSize,
      lineHeight: FEED_CARD_TYPE.nestedTicker.lineHeight,
      fontWeight: FEED_CARD_TYPE.nestedTicker.fontWeight,
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      letterSpacing: 0,
      flexShrink: 0,
      includeFontPadding: false,
    },
    nestedPrice: {
      direction: 'ltr',
      alignItems: 'flex-end',
      flexShrink: 1,
      minWidth: 0,
      gap: 2,
    },
    nestedPriceLabel: {
      writingDirection: 'rtl',
      textAlign: 'right',
      fontSize: FEED_CARD_TYPE.nestedLabel.fontSize,
      lineHeight: 13,
      fontWeight: FEED_CARD_TYPE.nestedLabel.fontWeight,
      color: tokens.colors.text.tertiary,
      includeFontPadding: false,
    },
    nestedPriceValue: {
      fontSize: FEED_CARD_TYPE.nestedPrice.fontSize,
      lineHeight: FEED_CARD_TYPE.nestedPrice.lineHeight,
      fontWeight: FEED_CARD_TYPE.nestedPrice.fontWeight,
      color: tokens.colors.text.primary,
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
      textAlign: 'right',
      includeFontPadding: false,
    },
    nestedPriceMissing: {
      writingDirection: 'rtl',
      textAlign: 'right',
      fontSize: FEED_CARD_TYPE.nestedLabel.fontSize,
      lineHeight: 13,
      fontWeight: FEED_CARD_TYPE.nestedLabel.fontWeight,
      color: tokens.colors.text.tertiary,
      includeFontPadding: false,
    },
    nestedSinceRow: {
      marginTop: 4,
      direction: 'ltr',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      justifyContent: 'flex-end',
      gap: 4,
    },
    nestedSinceLabel: {
      fontSize: FEED_CARD_TYPE.nestedLabel.fontSize,
      lineHeight: 13,
      fontWeight: FEED_CARD_TYPE.nestedLabel.fontWeight,
      color: tokens.colors.text.secondary,
      writingDirection: 'rtl',
      textAlign: 'right',
      flexShrink: 1,
      includeFontPadding: false,
    },
    nestedSinceValue: {
      fontSize: FEED_CARD_TYPE.nestedSince.fontSize,
      lineHeight: 13,
      fontWeight: FEED_CARD_TYPE.nestedSince.fontWeight,
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
      textAlign: 'right',
      flexShrink: 0,
      includeFontPadding: false,
    },
  });
}
