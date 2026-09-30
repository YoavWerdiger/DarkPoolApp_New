import type { TextStyle } from 'react-native';
import {
  APP_TYPE,
  appHebrewText,
  appPhysicalRightText,
  appSectionTitleStyle,
  appGroupLabelStyle,
  appCardTitleStyle,
  appBodyTextStyle,
  appCaptionStyle,
  appCaption2Style,
  appSheetButtonLabelStyle,
  appCardSubtitleStyle,
} from '../ui/appType';

/**
 * טיפוגרפיית הגדרות / פרטי קבוצה — אותה סקאלה כמו Explore (`appType`).
 * כותרת כרום (ChatSubScreenHeader) נשארת ממורכזת — לא כאן.
 *
 * section 22/700 · group 15/500 · card 17/600 · body 16/400 · meta 13 (APP_TYPE).
 * meta 13 · caption 12 — בלי title2 22 ובלי משקל 800.
 */
export { APP_TYPE as SETTINGS_TYPE };

/** כותרת תוכן גדולה מחוץ לכרטיס — 22/700 */
export const settingsHeroType: TextStyle = { ...APP_TYPE.sectionTitle };

/** תווית קבוצה אפורה מחוץ לכרטיס — 15/500 */
export const settingsGroupLabelType: TextStyle = { ...APP_TYPE.groupLabel };

/** שורת רשימה / כותרת בתוך כרטיס — 17/600 */
export const settingsRowType: TextStyle = { ...APP_TYPE.cardTitle };

/** גוף / תיאור / קלט */
export const settingsBodyType: TextStyle = { ...APP_TYPE.body };

/** רמז / סטטוס / כותרת משנה */
export const settingsMetaType: TextStyle = { ...APP_TYPE.footnote };

export const settingsCaptionType: TextStyle = { ...APP_TYPE.caption };
export const settingsCaption2Type: TextStyle = { ...APP_TYPE.caption2 };

export const settingsHebrewText = appHebrewText;
export const settingsPhysicalRightText = appPhysicalRightText;
export const settingsHeroTitleStyle = appSectionTitleStyle;
export const settingsGroupLabelStyle = appGroupLabelStyle;
export const settingsRowTitleStyle = appCardTitleStyle;

/** תת-כותרת בשורת toggle — צמודה לכותרת (titleSubtitleGap / cardTitleToSubtitleGap). */
export const settingsRowSubtitleStyle: TextStyle = { ...appCardSubtitleStyle };
export const settingsBodyStyle = appBodyTextStyle;
export const settingsCaptionStyle = appCaptionStyle;
export const settingsCaption2Style = appCaption2Style;
export const settingsButtonLabelStyle = appSheetButtonLabelStyle;
