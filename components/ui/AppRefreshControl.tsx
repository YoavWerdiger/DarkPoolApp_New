/**
 * משיכה-לרענון אחידה: הספינר בצבע ה-CTA של ערכת הנושא (לבן בכהה, שחור בבהיר) —
 * לא ירוק. תחליף drop-in ל-RefreshControl של react-native (הצבע תמיד נדרס כאן).
 */
import React from 'react';
import { RefreshControl as RNRefreshControl, type RefreshControlProps } from 'react-native';
import { useDesignTokens } from './DesignTokens';

export function RefreshControl(props: RefreshControlProps) {
  const tokens = useDesignTokens();
  const cta = tokens.colors.primary.lightCta;
  return (
    <RNRefreshControl
      {...props}
      tintColor={cta}
      colors={[cta]}
      progressBackgroundColor={tokens.colors.background.cardSolid}
    />
  );
}

export default RefreshControl;
