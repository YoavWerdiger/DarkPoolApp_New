import { StyleSheet, type ViewStyle } from 'react-native';
import type { useDesignTokens } from '../../../components/ui/DesignTokens';
import { UI_CARD_RADIUS } from '../../../components/ui/appLayout';
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
/** רדיוס כרטיס חיצוני — UI_CARD_RADIUS. */
export const FEED_OUTER_RADIUS = UI_CARD_RADIUS;
/** רווח אנכי בין כרטיסי פיד (לא padding פנימי ולא gutter צד). */
export const FEED_CARD_STACK_GAP = 12;
/** ריפוד פנימי של כרטיס הפיד — APP_LAYOUT.cardPadding (16) */
export const FEED_CARD_INNER_PAD = 16;
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

/** מעטפת אטומה — מילוי כרטיס של הערכה, לא זכוכית שקופה על הקנבס. */
export function tradeHeroGlassFrameStyle(
  tokens: DarkPoolFeedCardTokens,
  _opts?: { accent?: boolean }
): ViewStyle {
  return {
    borderRadius: UI_CARD_RADIUS,
    borderWidth: 0,
    overflow: 'hidden',
    backgroundColor: tokens.colors.background.cardSolid,
  };
}

export function tradeHeroInnerCardStyle(tokens: DarkPoolFeedCardTokens): ViewStyle {
  return {
    borderRadius: UI_CARD_RADIUS,
    borderWidth: 0,
    backgroundColor: tokens.colors.background.cardSolid,
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
  name: { ...APP_TYPE.cardTitle },
  action: { ...APP_TYPE.cardSubtitle, fontWeight: APP_TYPE.cardTitle.fontWeight },
  dates: APP_TYPE.cardSubtitle,
  nestedTicker: { ...APP_TYPE.cardSubtitle, fontWeight: APP_TYPE.cardTitle.fontWeight },
  nestedPrice: { ...APP_TYPE.body },
  nestedLabel: APP_TYPE.cardSubtitle,
  nestedSince: { ...APP_TYPE.cardSubtitle, fontWeight: APP_TYPE.cardTitle.fontWeight },
} as const;

/**
 * כרום גיבור פרטי-עסקה — מקור האמת לפיקסלים.
 * הפיד והמסך חולקים את אותם סגנונות כדי שהכרטיס יהיה זהה.
 */
export function createTradeHeroCardStyles(tokens: DarkPoolFeedCardTokens) {
  return StyleSheet.create({
    heroCard: {
      borderRadius: UI_CARD_RADIUS,
      backgroundColor: tokens.colors.background.cardSolid,
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
      fontWeight: FEED_CARD_TYPE.dates.fontWeight,
      color: tokens.colors.text.secondary,
    },
    personHintLtr: {
      ...ltrNameText,
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      fontWeight: FEED_CARD_TYPE.dates.fontWeight,
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
      fontWeight: FEED_CARD_TYPE.action.fontWeight,
    },
    actionRest: {
      fontSize: FEED_CARD_TYPE.action.fontSize,
      lineHeight: FEED_CARD_TYPE.action.lineHeight,
      color: tokens.colors.text.secondary,
      fontWeight: FEED_CARD_TYPE.dates.fontWeight,
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
