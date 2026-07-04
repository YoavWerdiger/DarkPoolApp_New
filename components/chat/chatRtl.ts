/**
 * כיוון טקסט בצ'אט — מרוכז כדי שייבוא `./chatRtl` לא יישבר ב-Metro.
 */
import { I18nManager } from 'react-native';

export type ChatTextDirection = 'rtl' | 'ltr';

export function isChatRtl(): boolean {
  try {
    return I18nManager.isRTL;
  } catch {
    return true;
  }
}

export function chatTextDirection(): ChatTextDirection {
  return isChatRtl() ? 'rtl' : 'ltr';
}
