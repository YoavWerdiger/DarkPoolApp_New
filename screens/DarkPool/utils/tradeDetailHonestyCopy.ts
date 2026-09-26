/**
 * מיקרוקופי כנות למסך פרטי עסקה — מאחורי כפתור `?`, ובקישור STOCK Act לקונגרס.
 */

import {
  STOCK_ACT_ESTIMATE_BODY,
  STOCK_ACT_ESTIMATE_GOT_IT,
} from './stockActEstimateCopy';

export const TRADE_DETAIL_HONESTY_GOT_IT = STOCK_ACT_ESTIMATE_GOT_IT;

export const TRADE_DETAIL_HONESTY_A11Y = 'על המספרים במסך';

export const CONGRESS_TRADE_HONESTY_TITLE = 'על המספרים';

export const CONGRESS_TRADE_HONESTY_BODY = STOCK_ACT_ESTIMATE_BODY;

export const INSIDER_TRADE_HONESTY_TITLE = 'על המספרים';

export const INSIDER_TRADE_HONESTY_BODY =
  'הכמות והמחיר למניה מגיעים מדיווח Form 4. השווי הוא מכפלת שניהם — לא ציטוט נפרד.\n\n' +
  'המחיר למעלה הוא ציטוט חי. «מאז העסקה» משווה אותו למחיר שבדיווח.\n\n' +
  'אין לנו סימון 10b5-1 ולא את סוג נייר הערך. קוד P/S הוא רכישה/מכירה לפי SEC — לא הוכחה לשוק פתוח מול עסקה פרטית.';
