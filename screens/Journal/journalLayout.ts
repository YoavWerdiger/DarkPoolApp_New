import type { ViewStyle } from 'react-native';

/**
 * טיפוגרפיית יומן מסחר — אותה סקאלה משותפת כמו Explore (`appType`).
 * כותרת כרום מסך (MainDrawerScreenHeader) נשארת ממורכזת.
 *
 * Yoga בשורש LTR — לא לגעת ב-App.tsx / I18nManager.
 * בתוך עץ rtl — row, לא row-reverse (בלי היפוך כפול).
 */
export {
  APP_TYPE as JOURNAL_TYPE,
  appHebrewText as journalHebrewText,
  appPhysicalRightText as journalPhysicalRightText,
  appSectionTitle as journalSectionTitle,
  appSectionTitleStyle as journalSectionTitleStyle,
  appSectionSubtitleStyle as journalSectionSubtitleStyle,
  appBodyTextStyle as journalBodyTextStyle,
  appCaptionStyle as journalCaptionStyle,
  appCaption2Style as journalCaption2Style,
  appCardTitleStyle as journalCardTitleStyle,
  appCardSubtitleStyle as journalCardSubtitleStyle,
  appCardMetricLabelStyle as journalCardMetricLabelStyle,
  appCardMetricValueStyle as journalCardMetricValueStyle,
  appCardMetricValueSecondaryStyle as journalCardMetricValueSecondaryStyle,
  appCardBodyStyle as journalCardBodyStyle,
} from '../../components/ui/appType';
export { APP_LAYOUT as JOURNAL_LAYOUT } from '../../components/ui/appLayout';

export const journalRtlRoot: ViewStyle = {
  flex: 1,
  direction: 'rtl',
};

export const journalRtlContent: ViewStyle = {
  direction: 'rtl',
};

/** בשורה בתוך עץ RTL — השתמש ב-row (לא row-reverse). */
export const journalRow: ViewStyle = {
  flexDirection: 'row',
};
