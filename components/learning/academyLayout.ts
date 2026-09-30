/**
 * אקדמיה / למידה — אותה סקאלת APP_TYPE כמו יומן ותיקים.
 * כרטיסי קורס: appCardTitleStyle + appCardSubtitleStyle (+2px) + appCardBodyStyle (+12px).
 */
import type { TextStyle } from 'react-native';
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';

export { APP_LAYOUT as ACADEMY_LAYOUT } from '../ui/appLayout';
export {
  APP_TYPE as ACADEMY_TYPE,
  appPhysicalRightText as academyPhysicalRightText,
  appPageTitleStyle as academyPageTitleStyle,
  appSectionTitleStyle as academySectionTitleStyle,
  appGroupLabelStyle as academyGroupLabelStyle,
  appSectionSubtitleStyle as academySectionSubtitleStyle,
  appCardTitleStyle as academyCardTitleStyle,
  appCardSubtitleStyle as academyCardSubtitleStyle,
  appCardBodyStyle as academyCardBodyStyle,
  appBodyTextStyle as academyBodyTextStyle,
  appCaptionStyle as academyCaptionStyle,
  appCaption2Style as academyCaption2Style,
  appSheetButtonLabelStyle as academyButtonLabelStyle,
  appCardMetricLabelStyle as academyMetricLabelStyle,
  appCardMetricValueStyle as academyMetricValueStyle,
  appCardMetricValueSecondaryStyle as academyMetricValueSecondaryStyle,
} from '../ui/appType';
export {
  ACADEMY_CARD_HP,
  ACADEMY_CARD_RADIUS,
  academyCardFrameStyle,
} from './academyCardLayout';

/** footnote 13/400 — משנה / תאריך / רמז */
export const academyFootnoteStyle: TextStyle = {
  ...appPhysicalRightText,
  fontSize: APP_TYPE.footnote.fontSize,
  fontWeight: APP_TYPE.footnote.fontWeight,
  lineHeight: APP_TYPE.footnote.lineHeight,
};
