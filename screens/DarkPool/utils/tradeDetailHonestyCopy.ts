import i18n from '../../../lib/i18n';
/**
 * מיקרוקופי כנות למסך פרטי עסקה — מאחורי כפתור `?`, ובקישור STOCK Act לקונגרס.
 */

import {
  STOCK_ACT_ESTIMATE_BODY,
  STOCK_ACT_ESTIMATE_GOT_IT,
} from './stockActEstimateCopy';

export const TRADE_DETAIL_HONESTY_GOT_IT = STOCK_ACT_ESTIMATE_GOT_IT;

export const TRADE_DETAIL_HONESTY_A11Y = i18n.t('auto.screens__DarkPool__utils__tradeDetailHonestyCopy.s1');

export const CONGRESS_TRADE_HONESTY_TITLE = i18n.t('auto.screens__DarkPool__utils__tradeDetailHonestyCopy.s2');

export const CONGRESS_TRADE_HONESTY_BODY = STOCK_ACT_ESTIMATE_BODY;

export const INSIDER_TRADE_HONESTY_TITLE = i18n.t('auto.screens__DarkPool__utils__tradeDetailHonestyCopy.s2');

export const INSIDER_TRADE_HONESTY_BODY =
  i18n.t('auto.screens__DarkPool__utils__tradeDetailHonestyCopy.s3');
