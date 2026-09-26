import type { TextStyle, ViewStyle } from 'react-native';
import { hebrewText } from './utils/bidi';

/**
 * מודול Dark Pool רץ תחת NavigationContainer ב-LTR (מגירה).
 * Yoga בשורש נשאר LTR — לא לגעת ב-App.tsx / I18nManager.
 *
 * כלל טקסט:
 * 1. כותרת מסך בהדר = center (MainDrawerScreenHeader / ChatSubScreenHeader)
 * 2. כל טקסט אחר = darkPoolPhysicalRightText (ימין פיזי)
 * בתוך תת-עץ rtl — row, לא row-reverse.
 *
 * סקאלת גודל/משקל מגיעה מ-`components/ui/appType` (אותה סקאלה כמו Explore).
 */
export {
  APP_TYPE as DARK_POOL_TYPE,
  appPhysicalRightText as darkPoolPhysicalRightText,
  appPhysicalLeftText as darkPoolPhysicalLeftText,
  appSectionTitle as darkPoolSectionTitle,
  appSectionTitleStyle as darkPoolSectionTitleStyle,
  appSectionSubtitleStyle as darkPoolSectionSubtitleStyle,
} from '../../components/ui/appType';

export const darkPoolRtlRoot: ViewStyle = {
  flex: 1,
  direction: 'rtl',
  backgroundColor: 'transparent',
};

export const darkPoolRtlContent: ViewStyle = {
  direction: 'rtl',
  backgroundColor: 'transparent',
};

/** מעטפת מסך/רשימה — בלי מילוי אטום מעל האורורה בשורש. */
export const darkPoolTransparentFill: ViewStyle = {
  flex: 1,
  backgroundColor: 'transparent',
};

/** בשורה בתוך עץ RTL — השתמש ב-row (לא row-reverse). */
export const darkPoolRow: ViewStyle = {
  flexDirection: 'row',
};

/** טקסט גוף/סקשן — אותו אובייקט כמו hebrewText */
export const darkPoolTextRtl: TextStyle = hebrewText;
