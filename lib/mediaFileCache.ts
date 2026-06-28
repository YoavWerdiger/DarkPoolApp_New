import * as FileSystem from 'expo-file-system/legacy';
import { logger } from '../utils/logger';

/**
 * Cache כללי של קבצי מדיה (אודיו/וידאו/מסמכים) על המכשיר — לכניסה מיידית ולתמיכה offline.
 * הקבצים ממופים לפי נתיב האחסון היציב (לא לפי ה-signed URL שמתחלף), עם namespace
 * לכל מקור (chat / stories / ...) כדי למנוע התנגשות שמות בין buckets שונים.
 *
 * תמונות לא נשמרות כאן — expo-image כבר שומר אותן לדיסק (cachePolicy="memory-disk").
 */
const TAG = 'MediaFileCache';
const CACHE_DIR = `${FileSystem.cacheDirectory}media-file-cache/`;
const MAX_FILES = 400; // תקרת קבצים; מעליה מפנים את הישנים ביותר

/** סיומות שכדאי לשמור מקומית (אודיו/וידאו/מסמכים). תמונות מטופלות ע"י expo-image. */
const CACHEABLE_EXT = new Set([
  'm4a', 'mp3', 'aac', 'wav', 'ogg', 'opus', 'caf', 'amr', // audio
  'mp4', 'mov', 'm4v', 'webm', '3gp', // video
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', // docs
]);

let dirReady = false;
/** שמות קבצים שקיימים על הדיסק (lookup סינכרוני) */
const downloadedFiles = new Set<string>();
/** הורדות בתהליך — מונע הורדה כפולה במקביל */
const inFlight = new Map<string, Promise<string | null>>();

function extOf(path: string): string {
  const clean = path.split('?')[0];
  const dot = clean.lastIndexOf('.');
  if (dot < 0) return '';
  return clean.slice(dot + 1).toLowerCase();
}

/** האם הנתיב הוא מדיה שכדאי לשמור מקומית */
export function isCacheableMediaPath(storagePath: string | null | undefined): boolean {
  if (!storagePath) return false;
  return CACHEABLE_EXT.has(extOf(storagePath));
}

/** שם קובץ מקומי דטרמיניסטי מ-namespace + נתיב האחסון (שומר סיומת אמיתית לתאימות נגנים) */
function fileNameFor(storagePath: string, namespace: string): string {
  const ext = extOf(storagePath);
  const base = `${namespace}__${storagePath.split('?')[0]}`.replace(/[^a-zA-Z0-9]/g, '_');
  return ext ? `${base}.${ext}` : `${base}.bin`;
}

async function ensureDir(): Promise<void> {
  if (dirReady) return;
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
    dirReady = true;
  } catch (error) {
    logger.warn(TAG, 'ensureDir failed', error);
  }
}

/** טוען את אינדקס הקבצים הקיימים לזיכרון — נקרא בהפעלה */
export async function hydrateMediaCacheIndex(): Promise<void> {
  try {
    await ensureDir();
    const names = await FileSystem.readDirectoryAsync(CACHE_DIR);
    downloadedFiles.clear();
    for (const name of names) downloadedFiles.add(name);
    void enforceLimit();
  } catch (error) {
    logger.warn(TAG, 'hydrate index failed', error);
  }
}

/** מחזיר URI מקומי אם הקובץ כבר נשמר — אחרת null (sync) */
export function getCachedLocalMediaUri(
  storagePath: string | null | undefined,
  namespace = 'chat',
): string | null {
  if (!storagePath || !isCacheableMediaPath(storagePath)) return null;
  const name = fileNameFor(storagePath, namespace);
  return downloadedFiles.has(name) ? CACHE_DIR + name : null;
}

/**
 * מוריד מדיה לדיסק (אם עדיין לא קיימת) ומחזיר את ה-URI המקומי.
 * remoteUrl = signed URL זמני. הקובץ נשמר לפי storagePath היציב + namespace.
 */
export async function downloadMediaToCache(
  storagePath: string,
  remoteUrl: string,
  namespace = 'chat',
): Promise<string | null> {
  if (!isCacheableMediaPath(storagePath)) return null;

  const name = fileNameFor(storagePath, namespace);
  const localUri = CACHE_DIR + name;
  if (downloadedFiles.has(name)) return localUri;

  const existing = inFlight.get(name);
  if (existing) return existing;

  const task = (async (): Promise<string | null> => {
    try {
      await ensureDir();
      const tmp = `${localUri}.part`;
      const res = await FileSystem.downloadAsync(remoteUrl, tmp);
      if (res.status !== 200) {
        try { await FileSystem.deleteAsync(tmp, { idempotent: true }); } catch { /* best effort */ }
        return null;
      }
      await FileSystem.moveAsync({ from: tmp, to: localUri });
      downloadedFiles.add(name);
      if (downloadedFiles.size > MAX_FILES) void enforceLimit();
      return localUri;
    } catch (error) {
      logger.warn(TAG, 'download failed', error);
      return null;
    } finally {
      inFlight.delete(name);
    }
  })();

  inFlight.set(name, task);
  return task;
}

/** מפנה את הקבצים הישנים ביותר כשעוברים את התקרה */
async function enforceLimit(): Promise<void> {
  try {
    const names = await FileSystem.readDirectoryAsync(CACHE_DIR);
    if (names.length <= MAX_FILES) return;

    const withTime = await Promise.all(
      names.map(async (name) => {
        const info = await FileSystem.getInfoAsync(CACHE_DIR + name);
        return { name, mtime: info.exists ? info.modificationTime ?? 0 : 0 };
      }),
    );
    withTime.sort((a, b) => a.mtime - b.mtime); // ישן → חדש

    const toRemove = withTime.slice(0, names.length - MAX_FILES);
    for (const item of toRemove) {
      try {
        await FileSystem.deleteAsync(CACHE_DIR + item.name, { idempotent: true });
        downloadedFiles.delete(item.name);
      } catch { /* best effort */ }
    }
  } catch (error) {
    logger.warn(TAG, 'enforceLimit failed', error);
  }
}

/** ניקוי כל ה-cache (logout) */
export async function clearMediaFileCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    downloadedFiles.clear();
    dirReady = false;
  } catch (error) {
    logger.warn(TAG, 'clear failed', error);
  }
}
