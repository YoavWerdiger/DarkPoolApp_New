/**
 * משיכה-לרענון אחידה — תחליף drop-in ל-RefreshControl של react-native, בצבע ה-CTA של ערכת הנושא.
 *
 * חשוב: לא מוסיפים כאן אלמנט נוסף (למשל טבעת absolute מעל התוכן). ב-iOS ה-RefreshControl
 * מרונדר בתוך ה-ScrollView, וב-Fabric כל ילד (כולל transform) נכנס ל-contentBounds —
 * זה הזיז את כל המסך למעלה (דף האקדמיה, כפתור התפריט וכו').
 */
import React from 'react';
import { Platform, RefreshControl as RNRefreshControl, type RefreshControlProps } from 'react-native';
import { useDesignTokens } from './DesignTokens';

export function RefreshControl({ hideNative, ...props }: RefreshControlProps & {
  /** iOS: מסתיר את הספינר הנייטיבי — הטבעת מגיעה מ-<RefreshRing> שמחוץ לרשימה */
  hideNative?: boolean;
}) {
  const tokens = useDesignTokens();
  const cta = tokens.colors.primary.lightCta;
  return (
    <RNRefreshControl
      {...props}
      tintColor={hideNative && Platform.OS === 'ios' ? 'transparent' : cta}
      colors={[cta]}
      progressBackgroundColor={tokens.colors.background.cardSolid}
    />
  );
}

export default RefreshControl;
