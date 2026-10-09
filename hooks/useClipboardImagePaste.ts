import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { PickedRecentMedia } from '../lib/mediaRecentsCache';
import { logger } from '../utils/logger';

/**
 * הדבקת תמונה מהלוח לצ'אט — TextInput של RN מתעלם מתמונות בלוח, אז כשיש תמונה
 * מציגים צ'יפ «הדבק תמונה», ובלחיצה התמונה נכנסת לפריוויו כמו מגיליון השיתוף.
 * hasImageAsync לא מקפיץ את בקשת ההרשאה של iOS — רק getImageAsync, אחרי לחיצה של המשתמש.
 * אחרי הדבקה/סגירה הצ'יפ נעלם עד שחוזרים לאפליקציה או שהלוח משתנה.
 */
export function useClipboardImagePaste(enabled: boolean) {
  const [available, setAvailable] = useState(false);
  const dismissedRef = useRef(false);

  const check = useCallback(async () => {
    if (!enabled || dismissedRef.current) {
      setAvailable(false);
      return;
    }
    try {
      const Clipboard = await import('expo-clipboard');
      setAvailable(await Clipboard.hasImageAsync());
    } catch {
      setAvailable(false);
    }
  }, [enabled]);

  useEffect(() => {
    void check();
    let prev = AppState.currentState;
    const appSub = AppState.addEventListener('change', (next) => {
      if (prev.match(/inactive|background/) && next === 'active') {
        // תוכן חדש הועתק כנראה באפליקציה אחרת
        dismissedRef.current = false;
        void check();
      }
      prev = next;
    });
    let clipSub: { remove: () => void } | null = null;
    let cancelled = false;
    void import('expo-clipboard').then((Clipboard) => {
      if (cancelled) return;
      clipSub = Clipboard.addClipboardListener(() => {
        dismissedRef.current = false;
        void check();
      });
    });
    return () => {
      cancelled = true;
      appSub.remove();
      clipSub?.remove();
    };
  }, [check]);

  const dismiss = useCallback(() => {
    dismissedRef.current = true;
    setAvailable(false);
  }, []);

  /** קורא את התמונה מהלוח ושומר לקובץ זמני. null אם אין / המשתמש סירב */
  const readImage = useCallback(async (): Promise<PickedRecentMedia | null> => {
    dismiss();
    try {
      const Clipboard = await import('expo-clipboard');
      const img = await Clipboard.getImageAsync({ format: 'jpeg', jpegQuality: 0.9 });
      if (!img?.data) return null;
      const base64 = img.data.replace(/^data:image\/\w+;base64,/, '');
      const stamp = Date.now();
      const uri = `${FileSystem.cacheDirectory}clipboard_${stamp}.jpg`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      return {
        id: `clipboard-${stamp}`,
        uri,
        thumbnailUri: uri,
        type: 'image',
        name: `photo_${stamp}.jpg`,
        width: img.size?.width,
        height: img.size?.height,
      };
    } catch (error) {
      logger.warn('useClipboardImagePaste', 'paste failed', error);
      return null;
    }
  }, [dismiss]);

  return { available, readImage, dismiss };
}
