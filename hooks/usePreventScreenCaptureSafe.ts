/**
 * חסימת צילומי מסך במסך הנוכחי (Android: FLAG_SECURE; iOS: מסך שחור בהקלטה) — כל עוד המסך בפוקוס.
 * בטוח לבילדים ישנים: expo-screen-capture נטען דינמית, ובלי המודול הנייטיב ה-hook לא עושה כלום.
 */
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { logger } from '../utils/logger';

type ScreenCaptureModule = {
  preventScreenCaptureAsync: (key?: string) => Promise<void>;
  allowScreenCaptureAsync: (key?: string) => Promise<void>;
};

let cached: ScreenCaptureModule | null | undefined;
function loadScreenCapture(): ScreenCaptureModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-screen-capture') as ScreenCaptureModule;
  } catch {
    cached = null; // בילד בלי המודול
  }
  return cached;
}

export function usePreventScreenCaptureSafe(key: string, enabled = true) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      const mod = loadScreenCapture();
      if (!mod) return;
      mod.preventScreenCaptureAsync(key).catch((e) => logger.warn('ScreenCapture', 'prevent failed', e));
      return () => {
        mod.allowScreenCaptureAsync(key).catch(() => undefined);
      };
    }, [key, enabled]),
  );
}
