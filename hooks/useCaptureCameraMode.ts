import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

type CaptureMode = 'picture' | 'video';

/** אחרי החלפת mode ב-Android — מחכים ל-onCameraReady, ולא יותר מזה */
const MODE_SWITCH_WAIT_MS = 700;

/**
 * mode של CameraView למסכי צילום (תמונה בלחיצה, וידאו בלחיצה ארוכה).
 *
 * iOS: תמיד 'video' — takePictureAsync עובד גם במצב וידאו, ובלי החלפה אין קפיצה בהקלטה.
 * Android: expo-camera (CameraX) מחבר ב-'video' רק VideoCapture — ImageCapture לא מחובר
 * ו-takePictureAsync נכשל תמיד («לא הצלחנו לצלם את התמונה»). לכן ברירת מחדל 'picture',
 * ומעבר ל-'video' רק לפני הקלטה.
 */
export function useCaptureCameraMode() {
  const [androidMode, setAndroidMode] = useState<CaptureMode>('picture');
  const modeRef = useRef<CaptureMode>('picture');
  const readyWaiters = useRef<Array<() => void>>([]);

  /** לחבר ל-onCameraReady של CameraView */
  const notifyCameraReady = useCallback(() => {
    const waiters = readyWaiters.current;
    readyWaiters.current = [];
    for (const resolve of waiters) resolve();
  }, []);

  const switchTo = useCallback(async (next: CaptureMode) => {
    if (Platform.OS !== 'android' || modeRef.current === next) return;
    const ready = new Promise<void>((resolve) => {
      readyWaiters.current.push(resolve);
      setTimeout(resolve, MODE_SWITCH_WAIT_MS);
    });
    modeRef.current = next;
    setAndroidMode(next);
    await ready;
  }, []);

  const ensureVideoMode = useCallback(() => switchTo('video'), [switchTo]);
  const ensurePictureMode = useCallback(() => switchTo('picture'), [switchTo]);

  const mode: CaptureMode = Platform.OS === 'android' ? androidMode : 'video';
  return useMemo(
    () => ({ mode, notifyCameraReady, ensureVideoMode, ensurePictureMode }),
    [mode, notifyCameraReady, ensureVideoMode, ensurePictureMode]
  );
}
