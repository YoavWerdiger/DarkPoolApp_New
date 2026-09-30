// UI Kit - Design System Components
// ===================================
// 
// מערכת עיצוב אחידה לכל האפליקציה
// בהשפעת WhatsApp עם עיצוב מקצועי ומודרני
//

export { default as UIButton } from './UIButton';
export { default as UIModal } from './UIModal';
export { default as UIBottomSheet } from './UIBottomSheet';
export { default as UIAlert } from './UIAlert';
export { AppDialogProvider, useAppDialog } from './AppDialogProvider';
export { default as UICard } from './UICard';
export { HelpSheet, InfoSheet, HELP_SHEET_GOT_IT } from './HelpSheet';
export type { HelpSheetProps } from './HelpSheet';
export { GlassChip, GLASS_CHIP_MIN_HEIGHT, GLASS_CHIP_RADIUS, GLASS_CHIP_CARD } from './GlassChip';
export type { GlassChipProps } from './GlassChip';
export {
  DayDividerPill,
  DAY_DIVIDER_CARD,
  DAY_DIVIDER_SELECTED_INTENSITY,
} from './DayDividerPill';
export type { DayDividerPillProps } from './DayDividerPill';
export {
  ChangeDot,
  SignedChange,
  SignedChangePair,
  CHANGE_DOT_SIZE,
  changeToneFromSigned,
  changeToneColor,
  formatSignedChangePct,
} from './ChangeDot';
export type { ChangeTone } from './ChangeDot';
export { DayNavBlurButton, DAY_NAV_BUTTON_SIZE, DRAWER_MENU_BUTTON_SIZE } from './DayNavBlurButton';
export { NavGlassSurface } from './NavGlassSurface';
export type { NavGlassSurfaceProps } from './NavGlassSurface';
export { navGlassBlurIntensity, navGlassOverlay } from './navGlass';
export { CHROME_UICARD, chromeSurfaceFill, chromeSurfaceCardStyle, searchFieldFill } from './chromeControl';
export { default as UIInput } from './UIInput';
export {
  sheetActionColors,
  sheetContentBottomPadding,
  sheetSafeBottomInset,
  sheetSystemBarFillHeight,
  SheetActionButton,
} from './BottomSheet';
export type { SheetActionVariant, SheetActionButtonProps } from './BottomSheet';

// Design Tokens
export { default as DesignTokens, SoftUI } from './DesignTokens';
export { APP_LAYOUT } from './appLayout';
export { PRODUCT_MODULES, PRODUCT_TOPOLOGY } from './productTopology';
export type { ProductModuleId, ProductModuleSpec } from './productTopology';
export {
  APP_TYPE,
  appPhysicalRightText,
  appHebrewText,
  appScreenTitleStyle,
  appScreenSubtitleStyle,
  appSectionTitleStyle,
  appSectionSubtitleStyle,
  appBodyTextStyle,
  appCaptionStyle,
  appCaption2Style,
  appSheetTitleStyle,
  appSheetSubtitleStyle,
  appSheetButtonLabelStyle,
} from './appType';
export { useDesignTokens } from './useDesignTokens';
export { ScreenChrome } from './ScreenChrome';
export {
  DarkGreenAuroraBackground,
  AURORA_BASE,
  AURORA_GREEN,
  AURORA_GREEN_BRAND,
  AURORA_GREEN_DEEP,
  AURORA_LAYER_OPACITY,
} from './DarkGreenAuroraBackground';
export { GradientBackground, AuroraHost } from './GradientBackground';
export { BrandTransbackWatermark } from './BrandTransbackWatermark';
export {
  MainDrawerScreenHeader,
  MAIN_SCREEN_HEADER_HP,
  MAIN_SCREEN_HEADER_TITLE_SIZE,
  MAIN_SCREEN_HEADER_TITLE_WEIGHT,
  MAIN_SCREEN_HEADER_TITLE_LINE_HEIGHT,
} from './MainDrawerScreenHeader';
export type { MainDrawerScreenHeaderProps } from './MainDrawerScreenHeader';

// Types
export type { UIButtonProps, UIButtonVariant } from './UIButton';
export type { UIModalProps } from './UIModal';
export type { UIBottomSheetProps } from './UIBottomSheet';
export type { UIAlertProps } from './UIAlert';
export type { UICardProps } from './UICard';
export { resolveUiCardBlur } from './cardGlass';
export type { UIInputProps } from './UIInput';

