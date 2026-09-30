/**
 * מרווחים — docs/DARKPOOL_DESIGN_DIRECTION.md (Blink / consumer rhythm).
 * מקור אמת יחיד; `DesignTokens.layout` מיושר לאותם ערכים.
 */
/** רדיוס מעטפת כרטיס — בלי stroke. */
export const UI_CARD_RADIUS = 24;

export const APP_LAYOUT = {
  /** padding אופקי למסך (מובייל 16–20) */
  screenPaddingHorizontal: 20,
  /** מרווח בין סקשנים מרכזיים */
  sectionGap: 40,
  /** מרווח בין כותרת תוכן (לבנה) לתוכן שמתחתיה */
  sectionHeaderToContent: 12,
  /** תווית קבוצה אפורה → הכרטיס שמתחתיה */
  groupLabelToContent: 8,
  /** מרווח בין כותרת לשורת משנה (הדר / סקשן) */
  titleSubtitleGap: 2,
  /** כותרת כרטיס → כותרת משנה (אפור, צמוד) */
  cardTitleToSubtitleGap: 2,
  /** כותרת כרטיס → גוף / גרף */
  cardTitleToBodyGap: 12,
  /** תווית מדד → ערך (בתוך תא KPI) */
  cardMetricLabelToValueGap: 4,
  /** ריפוד פנימי בכרטיס */
  cardPadding: 16,
  /** רווח בין כרטיסים / בלוקים באותו סקשן */
  cardStackGap: 12,
  /** רווח בין קומפוננטות (שדות, שורות) */
  componentGap: 16,
  /** רווח צ tight */
  stackGapTight: 12,
  stackGapSmall: 8,
} as const;
