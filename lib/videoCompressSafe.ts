/**
 * דחיסת וידאו לפני העלאה (צ'אט + סטוריז) — עטיפה בטוחה ל-react-native-compressor.
 *
 * כמו lib/expoAvSafe: בודקים שהמודול הנייטיב קיים לפני require. ב-Expo Go או בבילד
 * ישן בלי המודול (או בכל כישלון של הדחיסה) מחזירים את הקובץ המקורי — ההעלאה
 * ממשיכה כרגיל, רק בלי חיסכון בנפח.
 *
 * הגדרות: עד 1920px בצלע הארוכה (1080p), ~5Mbps (לא יותר מהביטרייט של המקור),
 * אודיו נשמר. מדלגים כשהקובץ כבר קטן (<8MB ו-≤1080p) או כשהפלט יצא גדול יותר.
 */
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { logger } from '../utils/logger';

const MAX_LONG_EDGE = 1920;
const TARGET_BITRATE = 5_000_000;
const MIN_BITRATE = 1_500_000;
const SKIP_BELOW_BYTES = 8 * 1024 * 1024;

export type CompressedVideo = {
  uri: string;
  size: number;
  /**
   * מידות ה-track (לפני סיבוב — ב-iOS וידאו portrait מדווח 1920x1080).
   * להצגה (media_width/height) להשתמש במידות מהפיקר; היחס נשמר בדחיסה.
   */
  width?: number;
  height?: number;
  /** true אם uri הוא קובץ חדש (דחוס) ולא המקור */
  compressed: boolean;
};

type CompressorLib = {
  Video: {
    compress: (
      uri: string,
      options: Record<string, unknown>,
      onProgress?: (progress: number) => void,
    ) => Promise<string>;
  };
  getVideoMetaData: (uri: string) => Promise<{
    width: number;
    height: number;
    duration: number;
    size: number;
  }>;
};

let cached: CompressorLib | null | undefined;

function hasNativeCompressor(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  try {
    const turbo = (TurboModuleRegistry as any)?.get?.('Compressor');
    if (turbo) return true;
  } catch {
    /* ignore */
  }
  try {
    return NativeModules?.Compressor != null;
  } catch {
    return false;
  }
}

function loadCompressor(): CompressorLib | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (!hasNativeCompressor()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-compressor');
    if (mod?.Video?.compress) cached = mod as CompressorLib;
  } catch (e) {
    logger.warn('VideoCompress', 'react-native-compressor failed to load', e);
  }
  return cached;
}

export function isVideoCompressionAvailable(): boolean {
  return loadCompressor() != null;
}

async function fileSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && typeof info.size === 'number' ? info.size : 0;
  } catch {
    return 0;
  }
}

function withFileScheme(uri: string): string {
  return uri.startsWith('/') ? `file://${uri}` : uri;
}

// דחיסה אחת בכל רגע (אלבום של כמה סרטונים) — מקודדי חומרה מקבילים נכשלים/מאטים
let queue: Promise<unknown> = Promise.resolve();

/**
 * מחזיר קובץ להעלאה — דחוס אם אפשר ומשתלם, אחרת המקור.
 * לא זורק אף פעם. onProgress מקבל 0..1 (רק בזמן דחיסה בפועל).
 */
export function compressVideoForUpload(
  uri: string,
  onProgress?: (fraction: number) => void,
): Promise<CompressedVideo> {
  const run = queue.then(() => compressNow(uri, onProgress));
  queue = run.catch(() => undefined);
  return run;
}

async function compressNow(
  uri: string,
  onProgress?: (fraction: number) => void,
): Promise<CompressedVideo> {
  const originalSize = await fileSize(uri);
  const original: CompressedVideo = { uri, size: originalSize, compressed: false };

  const lib = loadCompressor();
  if (!lib) return original;

  let width: number | undefined;
  let height: number | undefined;
  let durationSec = 0;
  try {
    const meta = await lib.getVideoMetaData(uri);
    width = Number(meta?.width) || undefined;
    height = Number(meta?.height) || undefined;
    durationSec = Number(meta?.duration) || 0;
  } catch {
    /* מטא-דאטה לא קריטית */
  }

  // הצלע הארוכה לא תלויה בסיבוב (portrait/landscape), אז אפשר לסמוך עליה גם בלי transform
  const longEdge = Math.max(width || 0, height || 0);
  const smallEnough = originalSize > 0 && originalSize < SKIP_BELOW_BYTES;
  if (smallEnough && (longEdge === 0 || longEdge <= MAX_LONG_EDGE)) {
    return { ...original, width, height };
  }

  // לא מבקשים ביטרייט גבוה מהמקור — אחרת הפלט רק יגדל
  let bitrate = TARGET_BITRATE;
  if (originalSize > 0 && durationSec > 0) {
    const sourceBitrate = (originalSize * 8) / durationSec;
    bitrate = Math.round(Math.max(MIN_BITRATE, Math.min(TARGET_BITRATE, sourceBitrate * 0.85)));
  }

  const startedAt = Date.now();
  try {
    const out = await lib.Video.compress(
      uri,
      {
        compressionMethod: 'manual',
        maxSize: MAX_LONG_EDGE,
        bitrate,
        progressDivider: 5,
      },
      onProgress
        ? (p: number) => {
            const fraction = p > 1 ? p / 100 : p;
            if (Number.isFinite(fraction)) onProgress(Math.max(0, Math.min(1, fraction)));
          }
        : undefined,
    );
    const outUri = out ? withFileScheme(String(out)) : '';
    if (!outUri || outUri === uri) return { ...original, width, height };

    const outSize = await fileSize(outUri);
    if (!outSize || (originalSize > 0 && outSize >= originalSize)) {
      logger.info(
        'VideoCompress',
        `skip: output not smaller (${originalSize} -> ${outSize})`,
      );
      void FileSystem.deleteAsync(outUri, { idempotent: true }).catch(() => {});
      return { ...original, width, height };
    }

    // מידות הפלט: אותו יחס, צלע ארוכה מוגבלת ל-1920
    let outW = width;
    let outH = height;
    if (width && height && longEdge > MAX_LONG_EDGE) {
      const scale = MAX_LONG_EDGE / longEdge;
      outW = Math.round(width * scale);
      outH = Math.round(height * scale);
    }

    logger.info(
      'VideoCompress',
      `ok ${originalSize} -> ${outSize} bytes, bitrate=${bitrate}, ${Date.now() - startedAt}ms`,
    );
    return { uri: outUri, size: outSize, width: outW, height: outH, compressed: true };
  } catch (e) {
    logger.warn('VideoCompress', 'compression failed, uploading original', e);
    return { ...original, width, height };
  }
}

/** ניקוי קובץ דחוס זמני אחרי העלאה (רק אם נוצר על ידינו) */
export function discardCompressedVideo(result: CompressedVideo): void {
  if (!result.compressed) return;
  void FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
}
