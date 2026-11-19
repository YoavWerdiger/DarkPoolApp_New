/**
 * משיכה-לרענון אחידה — תחליף drop-in ל-RefreshControl של react-native, בצבע ה-CTA של ערכת הנושא.
 *
 * חשוב: לא מוסיפים כאן אלמנט נוסף (למשל טבעת absolute מעל התוכן). ב-iOS ה-RefreshControl
 * מרונדר בתוך ה-ScrollView, וב-Fabric כל ילד (כולל transform) נכנס ל-contentBounds —
 * זה הזיז את כל המסך למעלה (דף האקדמיה, כפתור התפריט וכו').
 */
import React, { useEffect, useRef, useState } from 'react';
import { Platform, RefreshControl as RNRefreshControl, type RefreshControlProps } from 'react-native';
import { useDesignTokens } from './DesignTokens';

/**
 * iOS: כשהרענון נגמר מהר (cache) ה-refreshing חוזר ל-false לפני שאנימציית הפתיחה של
 * UIRefreshControl הסתיימה — והתוכן «חוזר» לא למקום (גבוה מדי). מחזיקים מינימום זמן.
 */
const MIN_REFRESH_MS = 700;

function useMinDurationRefreshing(refreshing: boolean): boolean {
  const [shown, setShown] = useState(refreshing);
  const startedAt = useRef(0);
  useEffect(() => {
    if (refreshing) {
      startedAt.current = Date.now();
      setShown(true);
      return;
    }
    const left = MIN_REFRESH_MS - (Date.now() - startedAt.current);
    if (left <= 0) {
      setShown(false);
      return;
    }
    const id = setTimeout(() => setShown(false), left);
    return () => clearTimeout(id);
  }, [refreshing]);
  return shown;
}

export function RefreshControl({ hideNative, ...props }: RefreshControlProps & {
  /** iOS: מסתיר את הספינר הנייטיבי — הטבעת מגיעה מ-<RefreshRing> שמחוץ לרשימה */
  hideNative?: boolean;
}) {
  const tokens = useDesignTokens();
  const cta = tokens.colors.primary.lightCta;
  const refreshing = useMinDurationRefreshing(!!props.refreshing);
  return (
    <RNRefreshControl
      {...props}
      refreshing={refreshing}
      tintColor={hideNative && Platform.OS === 'ios' ? 'transparent' : cta}
      colors={[cta]}
      progressBackgroundColor={tokens.colors.background.cardSolid}
    />
  );
}

export default RefreshControl;
