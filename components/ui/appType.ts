import type { TextStyle, ViewStyle } from 'react-native';
import { APP_LAYOUT } from './appLayout';
import { SoftUI } from './softUiPalette';
import { APP_CTA_LABEL_FONT } from './appFont';

/**
 * סקאלת טיפוגרפיה אחת — Soft UI / Blink-inspired consumer fintech.
 * docs/DARKPOOL_DESIGN_DIRECTION.md §11–12, §42–46.
 *
 * שלוש רמות צבע (מיושמות בקומפוננטות דרך tokens / SoftUI):
 * primary #FFFFFF · secondary #8E8E93 · muted #636366
 *
 * כותרת כרום מסך = screenTitle (ממורכז, MainDrawerScreenHeader).
 * Yoga בשורש LTR — בתוך עץ rtl: row, לא row-reverse.
 */
export const appRtlRoot: ViewStyle = {
  flex: 1,
  direction: 'rtl',
};

export const appRtlContent: ViewStyle = {
  direction: 'rtl',
};

export const appRow: ViewStyle = {
  flexDirection: 'row',
};

export const appHebrewText: TextStyle = {
  writingDirection: 'rtl',
  textAlign: 'right',
};

export const appPhysicalRightText: TextStyle = {
  ...appHebrewText,
  direction: 'ltr',
  textAlign: 'right',
  writingDirection: 'rtl',
};

export const appPhysicalLeftText: TextStyle = {
  direction: 'ltr',
  textAlign: 'left',
  writingDirection: 'ltr',
};

export const appSectionTitle: TextStyle = {
  ...appPhysicalRightText,
  width: '100%',
  alignSelf: 'stretch',
};

/** סקאלת מוצר — מקור אמת יחיד (Journal / Dark Pool / Settings / Explore) */
export const APP_TYPE = {
  /** כותרת מסך בהדר ממורכז — page title mobile (לא hero) */
  screenTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: -0.42,
  },
  /** כותרת מערכת מתחת לכפתור התפריט — כמו «פרופיל», ימין */
  pageTitle: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 38,
    letterSpacing: -0.42,
  },
  /** כותרת מסך בזרימת רישום / onboarding (מסך מלא, ימין) */
  flowTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.42,
  },
  flowTitleCompact: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: -0.42,
  },
  /** כותרת תוכן מחוץ לכרטיס — לבנה, Bold (לא 800) */
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: -0.42,
  },
  /** תווית קבוצה מחוץ לכרטיס — אפורה, קטנה משורת הכרטיס, Medium */
  groupLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  sectionSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  /** מתחת לכותרת הכרטיס — אפור, צמוד (titleSubtitleGap) */
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  /** תווית KPI / מדד בכרטיס */
  cardMetricLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
  },
  /** ערך מדד ראשי (סיכום P&L, Win Rate) */
  cardMetricValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 32,
    letterSpacing: -0.55,
  },
  /** ערך מדד משני בתא קטן */
  cardMetricValueSecondary: {
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 24,
    letterSpacing: -0.35,
  },
  /** גוף טקסט בתוך כרטיס — גודל קבוע */
  cardBody: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  caption2: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 14,
  },
} as const;

export const appScreenTitleStyle: TextStyle = {
  fontSize: APP_TYPE.screenTitle.fontSize,
  fontWeight: APP_TYPE.screenTitle.fontWeight,
  lineHeight: APP_TYPE.screenTitle.lineHeight,
  letterSpacing: APP_TYPE.screenTitle.letterSpacing,
  textAlign: 'center',
  writingDirection: 'rtl',
  color: SoftUI.textPrimary,
};

/** כותרת מערכת גדולה, ימין פיזי גם בתוך עץ rtl (יומן / אינסיידרים). */
export const appPageTitleStyle: TextStyle = {
  ...appPhysicalRightText,
  width: '100%',
  alignSelf: 'stretch',
  fontSize: APP_TYPE.pageTitle.fontSize,
  fontWeight: APP_TYPE.pageTitle.fontWeight,
  lineHeight: APP_TYPE.pageTitle.lineHeight,
  letterSpacing: APP_TYPE.pageTitle.letterSpacing,
};

export const appSectionTitleStyle: TextStyle = {
  ...appSectionTitle,
  fontSize: APP_TYPE.sectionTitle.fontSize,
  fontWeight: APP_TYPE.sectionTitle.fontWeight,
  lineHeight: APP_TYPE.sectionTitle.lineHeight,
  letterSpacing: APP_TYPE.sectionTitle.letterSpacing,
};

export const appGroupLabelStyle: TextStyle = {
  ...appSectionTitle,
  fontSize: APP_TYPE.groupLabel.fontSize,
  fontWeight: APP_TYPE.groupLabel.fontWeight,
  lineHeight: APP_TYPE.groupLabel.lineHeight,
  color: SoftUI.textSecondary,
  marginBottom: APP_LAYOUT.groupLabelToContent,
};

export const appSectionSubtitleStyle: TextStyle = {
  ...appSectionTitle,
  marginTop: APP_LAYOUT.titleSubtitleGap,
  fontSize: APP_TYPE.sectionSubtitle.fontSize,
  lineHeight: APP_TYPE.sectionSubtitle.lineHeight,
  fontWeight: APP_TYPE.sectionSubtitle.fontWeight,
};

/** כותרת משנה מתחת לכותרת מסך ממורכזת (MainDrawer / ChatSub / Portfolio). */
export const appScreenSubtitleStyle: TextStyle = {
  marginTop: APP_LAYOUT.titleSubtitleGap,
  fontSize: APP_TYPE.sectionSubtitle.fontSize,
  lineHeight: APP_TYPE.sectionSubtitle.lineHeight,
  fontWeight: APP_TYPE.sectionSubtitle.fontWeight,
  textAlign: 'center',
  writingDirection: 'rtl',
  width: '100%',
};

/** כותרת + תת-כותרת בזרימת רישום (RTL, תת-כותרת אפורה צמודה). */
export const appFlowTitleStyle: TextStyle = {
  ...appPhysicalRightText,
  width: '100%',
  alignSelf: 'stretch',
  fontSize: APP_TYPE.flowTitle.fontSize,
  fontWeight: APP_TYPE.flowTitle.fontWeight,
  lineHeight: APP_TYPE.flowTitle.lineHeight,
  letterSpacing: APP_TYPE.flowTitle.letterSpacing,
  color: SoftUI.textPrimary,
};

export const appFlowTitleCompactStyle: TextStyle = {
  ...appFlowTitleStyle,
  fontSize: APP_TYPE.flowTitleCompact.fontSize,
  lineHeight: APP_TYPE.flowTitleCompact.lineHeight,
  letterSpacing: APP_TYPE.flowTitleCompact.letterSpacing,
};

export const appFlowSubtitleStyle: TextStyle = {
  ...appPhysicalRightText,
  width: '100%',
  alignSelf: 'stretch',
  marginTop: APP_LAYOUT.titleSubtitleGap,
  fontSize: APP_TYPE.sectionSubtitle.fontSize,
  lineHeight: APP_TYPE.sectionSubtitle.lineHeight,
  fontWeight: APP_TYPE.sectionSubtitle.fontWeight,
  color: SoftUI.textSecondary,
};

export const appBodyTextStyle: TextStyle = {
  ...appPhysicalRightText,
  fontSize: APP_TYPE.body.fontSize,
  fontWeight: APP_TYPE.body.fontWeight,
  lineHeight: APP_TYPE.body.lineHeight,
};

export const appCardTitleStyle: TextStyle = {
  ...appPhysicalRightText,
  width: '100%',
  alignSelf: 'stretch',
  fontSize: APP_TYPE.cardTitle.fontSize,
  fontWeight: APP_TYPE.cardTitle.fontWeight,
  lineHeight: APP_TYPE.cardTitle.lineHeight,
  letterSpacing: APP_TYPE.cardTitle.letterSpacing,
};

export const appCardSubtitleStyle: TextStyle = {
  ...appPhysicalRightText,
  width: '100%',
  alignSelf: 'stretch',
  marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
  fontSize: APP_TYPE.cardSubtitle.fontSize,
  fontWeight: APP_TYPE.cardSubtitle.fontWeight,
  lineHeight: APP_TYPE.cardSubtitle.lineHeight,
  color: SoftUI.textSecondary,
};

export const appCardMetricLabelStyle: TextStyle = {
  ...appPhysicalRightText,
  fontSize: APP_TYPE.cardMetricLabel.fontSize,
  fontWeight: APP_TYPE.cardMetricLabel.fontWeight,
  lineHeight: APP_TYPE.cardMetricLabel.lineHeight,
  color: SoftUI.textSecondary,
  textAlign: 'center',
};

/** תווית שדה (שם מלא, טלפון…) — זהה ל-cardMetricLabel */
export const appFormFieldLabelStyle: TextStyle = {
  ...appCardMetricLabelStyle,
  textAlign: 'right',
  marginBottom: 8,
};

export const appCardMetricValueStyle: TextStyle = {
  fontSize: APP_TYPE.cardMetricValue.fontSize,
  fontWeight: APP_TYPE.cardMetricValue.fontWeight,
  lineHeight: APP_TYPE.cardMetricValue.lineHeight,
  letterSpacing: APP_TYPE.cardMetricValue.letterSpacing,
  textAlign: 'center',
  writingDirection: 'ltr',
};

export const appCardMetricValueSecondaryStyle: TextStyle = {
  fontSize: APP_TYPE.cardMetricValueSecondary.fontSize,
  fontWeight: APP_TYPE.cardMetricValueSecondary.fontWeight,
  lineHeight: APP_TYPE.cardMetricValueSecondary.lineHeight,
  letterSpacing: APP_TYPE.cardMetricValueSecondary.letterSpacing,
  textAlign: 'center',
  writingDirection: 'ltr',
};

export const appCardBodyStyle: TextStyle = {
  ...appPhysicalRightText,
  fontSize: APP_TYPE.cardBody.fontSize,
  fontWeight: APP_TYPE.cardBody.fontWeight,
  lineHeight: APP_TYPE.cardBody.lineHeight,
};

export const appCaptionStyle: TextStyle = {
  ...appPhysicalRightText,
  fontSize: APP_TYPE.caption.fontSize,
  fontWeight: APP_TYPE.caption.fontWeight,
  lineHeight: APP_TYPE.caption.lineHeight,
};

export const appFormFieldHelperStyle: TextStyle = {
  ...appCaptionStyle,
  color: SoftUI.textMuted,
  marginTop: 8,
};

export const appCaption2Style: TextStyle = {
  ...appPhysicalRightText,
  fontSize: APP_TYPE.caption2.fontSize,
  fontWeight: APP_TYPE.caption2.fontWeight,
  lineHeight: APP_TYPE.caption2.lineHeight,
};

export const appSheetTitleStyle: TextStyle = {
  ...appSectionTitleStyle,
};

export const appSheetSubtitleStyle: TextStyle = {
  ...appPhysicalRightText,
  fontSize: APP_TYPE.sectionSubtitle.fontSize,
  lineHeight: APP_TYPE.sectionSubtitle.lineHeight,
  fontWeight: APP_TYPE.sectionSubtitle.fontWeight,
};

export const appSheetButtonLabelStyle: TextStyle = {
  fontSize: APP_TYPE.body.fontSize,
  ...APP_CTA_LABEL_FONT,
  lineHeight: APP_TYPE.body.lineHeight,
  textAlign: 'center',
};
