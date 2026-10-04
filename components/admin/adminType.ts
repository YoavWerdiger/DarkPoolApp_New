import type { TextStyle } from 'react-native';
import { APP_TYPE, appHebrewText, appPhysicalRightText } from '../ui/appType';

/** פאנל מנהלים — אותה סקאלה כמו שאר המוצר. בלי fontSize מקומי ובלי משקל 800. */
export { APP_TYPE as ADMIN_TYPE };

export const adminHebrewText = appHebrewText;
export const adminPhysicalRightText = appPhysicalRightText;

export const adminPageTitle: TextStyle = { ...APP_TYPE.screenTitle };
export const adminSectionTitle: TextStyle = { ...APP_TYPE.sectionTitle };
export const adminGroupLabel: TextStyle = { ...APP_TYPE.groupLabel };
export const adminCardTitle: TextStyle = { ...APP_TYPE.cardTitle };
export const adminCardSubtitle: TextStyle = { ...APP_TYPE.cardSubtitle };
export const adminBody: TextStyle = { ...APP_TYPE.cardBody };
export const adminCaption: TextStyle = { ...APP_TYPE.caption };
export const adminCaption2: TextStyle = { ...APP_TYPE.caption2 };
export const adminMetricLabel: TextStyle = { ...APP_TYPE.cardMetricLabel };
export const adminMetric: TextStyle = { ...APP_TYPE.cardMetricValue };
export const adminMetricSecondary: TextStyle = { ...APP_TYPE.cardMetricValueSecondary };
