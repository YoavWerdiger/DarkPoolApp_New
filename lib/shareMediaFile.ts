import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getChatMediaDisplayUri } from '../services/chat/chatSignedMediaUrl';
import { logger } from '../utils/logger';

/**
 * שיתוף מדיה החוצה כקובץ אמיתי (PNG/JPG/MP4/M4A/PDF…) — לא כקישור ל-bucket.
 * Share.share({ url }) עם signed URL שיתף ב-iOS לינק לאחסון, ובאנדרואיד url בכלל לא נשלח.
 * כאן: קובץ מקומי (או הורדה לקאש עם סיומת נכונה) → expo-sharing עם mimeType/UTI,
 * כך שבגיליון השיתוף מופיעים «שמירת תמונה», וואטסאפ כתמונה וכו'.
 */

export type ShareMediaKind = 'image' | 'video' | 'audio' | 'document';

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  caf: 'audio/x-caf',
  ogg: 'audio/ogg',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  txt: 'text/plain',
  zip: 'application/zip',
};

const UTI_BY_EXT: Record<string, string> = {
  jpg: 'public.jpeg',
  jpeg: 'public.jpeg',
  png: 'public.png',
  gif: 'com.compuserve.gif',
  heic: 'public.heic',
  mp4: 'public.mpeg-4',
  mov: 'com.apple.quicktime-movie',
  m4a: 'public.mpeg-4-audio',
  mp3: 'public.mp3',
  wav: 'com.microsoft.waveform-audio',
  pdf: 'com.adobe.pdf',
  txt: 'public.plain-text',
  csv: 'public.comma-separated-values-text',
  zip: 'public.zip-archive',
};

const DEFAULT_EXT: Record<ShareMediaKind, string> = {
  image: 'jpg',
  video: 'mp4',
  audio: 'm4a',
  document: 'pdf',
};

const SHARE_DIR = `${FileSystem.cacheDirectory}share/`;

function extFromPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.split(/[?#]/)[0];
  const last = clean.split('/').pop() ?? '';
  const dot = last.lastIndexOf('.');
  if (dot <= 0 || dot === last.length - 1) return null;
  const ext = last.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : null;
}

function extFromMime(mime: string | null | undefined): string | null {
  if (!mime) return null;
  const m = mime.split(';')[0].trim().toLowerCase();
  const hit = Object.entries(MIME_BY_EXT).find(([, v]) => v === m);
  return hit ? hit[0] : null;
}

function baseName(value: string | null | undefined): string | null {
  if (!value) return null;
  const last = value.split(/[?#]/)[0].split('/').pop() ?? '';
  const dot = last.lastIndexOf('.');
  const base = (dot > 0 ? last.slice(0, dot) : last).replace(/[^\w֐-׿.-]+/g, '_').slice(0, 80);
  return base || null;
}

function headerValue(headers: Record<string, string> | undefined, key: string): string | null {
  if (!headers) return null;
  const hit = Object.keys(headers).find((k) => k.toLowerCase() === key);
  return hit ? headers[hit] : null;
}

async function ensureShareDir() {
  const info = await FileSystem.getInfoAsync(SHARE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(SHARE_DIR, { intermediates: true });
}

/** קובץ מקומי משותף, עם סיומת. null אם ההורדה נכשלה */
async function resolveLocalFile(
  source: string,
  kind: ShareMediaKind,
  fileName: string | null | undefined,
): Promise<{ uri: string; ext: string } | null> {
  const isLocal = source.startsWith('file:');
  const knownExt = extFromPath(fileName) ?? extFromPath(source);

  if (isLocal && knownExt) return { uri: source, ext: knownExt };

  await ensureShareDir();
  const stamp = Date.now();
  const name = baseName(fileName) ?? baseName(source) ?? `${kind}_${stamp}`;

  if (isLocal) {
    // קובץ מקומי בלי סיומת (למשל מהקאש) — עותק עם סיומת, אחרת אפליקציות לא מזהות את הסוג
    const ext = DEFAULT_EXT[kind];
    const target = `${SHARE_DIR}${name}_${stamp}.${ext}`;
    await FileSystem.copyAsync({ from: source, to: target });
    return { uri: target, ext };
  }

  const remote = (await getChatMediaDisplayUri(source)) ?? source;
  if (remote.startsWith('file:')) {
    // כבר בקאש המקומי — עותק עם סיומת (מהנתיב המקורי / ברירת מחדל לסוג)
    const ext = knownExt ?? extFromPath(remote) ?? DEFAULT_EXT[kind];
    const target = `${SHARE_DIR}${name}_${stamp}.${ext}`;
    await FileSystem.copyAsync({ from: remote, to: target });
    return { uri: target, ext };
  }
  if (!/^https?:/i.test(remote)) return null;
  const tmp = `${SHARE_DIR}${name}_${stamp}.part`;
  const res = await FileSystem.downloadAsync(remote, tmp);
  if (res.status < 200 || res.status >= 300) {
    await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
    return null;
  }
  const ext =
    knownExt ??
    extFromPath(remote) ??
    extFromMime(headerValue(res.headers, 'content-type')) ??
    DEFAULT_EXT[kind];
  const target = `${SHARE_DIR}${name}_${stamp}.${ext}`;
  await FileSystem.moveAsync({ from: tmp, to: target });
  return { uri: target, ext };
}

/**
 * source: URI מקומי, signed URL, או נתיב/URL של storage (נחתם כאן).
 * מחזיר false אם לא הצליח (הקורא יכול להציג הודעה).
 */
export async function shareMediaFile(
  source: string | null | undefined,
  opts: { kind: ShareMediaKind; fileName?: string | null; dialogTitle?: string } = { kind: 'image' },
): Promise<boolean> {
  if (!source) return false;
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    const local = await resolveLocalFile(source.trim(), opts.kind, opts.fileName);
    if (!local) return false;
    await Sharing.shareAsync(local.uri, {
      mimeType: MIME_BY_EXT[local.ext],
      UTI: UTI_BY_EXT[local.ext],
      dialogTitle: opts.dialogTitle,
    });
    return true;
  } catch (error) {
    logger.warn('shareMediaFile', 'share failed', error);
    return false;
  }
}
