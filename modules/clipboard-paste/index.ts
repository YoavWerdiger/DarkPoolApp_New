import { requireOptionalNativeModule } from 'expo-modules-core';
import type { EventSubscription } from 'expo-modules-core';

export type PastedImage = { uri: string; width?: number; height?: number };

type ClipboardPasteNative = {
  addListener(
    event: 'onPasteImages',
    listener: (e: { items: PastedImage[] }) => void,
  ): EventSubscription;
};

/** null ב-Expo Go / build ישן בלי המודול — אז נשאר רק צ'יפ ההדבקה */
const ClipboardPaste = requireOptionalNativeModule<ClipboardPasteNative>('ClipboardPaste');

/**
 * «הדבק» מהמערכת/מהמקלדת כשבלוח יש תמונה → קבצים מקומיים.
 * כל עוד יש מאזין, תמונות בלוח לא נבלעות בשדות הטקסט של RN.
 */
export function addPasteImagesListener(
  listener: (items: PastedImage[]) => void,
): { remove: () => void } | null {
  if (!ClipboardPaste) return null;
  return ClipboardPaste.addListener('onPasteImages', (e) => listener(e?.items ?? []));
}

export const nativeImagePasteAvailable = ClipboardPaste != null;
