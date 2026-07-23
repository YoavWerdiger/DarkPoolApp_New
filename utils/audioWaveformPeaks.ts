/**
 * חילוץ ויבפורם מפיקים אמיתיים של קובץ WAV (PCM),
 * ומיפוי metering חי (dBFS) לרמת 0–1 לצורך feedback בזמן הקלטה.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { normalizeWaveformSamples, WAVEFORM_STORE_BARS } from './waveformSamples';
import { logger } from './logger';

/** dBFS → 0–1 לרמות דיבור (לא למוזיקה). */
export function meteringDbToLevel(db: number): number {
  if (!Number.isFinite(db) || db <= -80) return 0;
  // רצפת שקט נמוכה יותר — דיבור רך עדיין נכנס לטווח
  const MIN_DB = -60;
  const MAX_DB = -6;
  const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db));
  const linear = (clamped - MIN_DB) / (MAX_DB - MIN_DB);
  // gamma נמוך מגביר mid-low — מילים שקטות מקבלות גובה בר ברור
  return Math.pow(linear, 0.52);
}

/**
 * בונה ויבפורם סופי לשמירה בהודעה.
 * מעדיף peaks מהקובץ (WAV/PCM); אחרת envelope מ־metering חי.
 */
export async function resolveMessageWaveform(
  uri: string | null | undefined,
  liveSamples: number[],
  barCount: number = WAVEFORM_STORE_BARS,
): Promise<number[]> {
  if (uri) {
    const fromFile = await extractPeaksFromWavFile(uri, barCount);
    if (fromFile && fromFile.length >= 2) {
      return fromFile;
    }
  }
  return normalizeWaveformSamples(liveSamples, barCount);
}

export async function extractPeaksFromWavFile(
  uri: string,
  barCount: number,
): Promise<number[] | null> {
  try {
    const lower = uri.toLowerCase();
    if (
      lower.includes('.m4a') ||
      lower.includes('.mp4') ||
      lower.includes('.3gp') ||
      lower.includes('.aac') ||
      lower.includes('.webm')
    ) {
      return null;
    }

    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    // הגנה מפני קבצים ענקיים שחוסמים את ה-JS thread
    if (typeof info.size === 'number' && info.size > 6 * 1024 * 1024) {
      return null;
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const ab = decode(base64);
    return peaksFromWavArrayBuffer(ab, barCount);
  } catch (error) {
    logger.warn('Waveform', 'WAV peak extract failed', error);
    return null;
  }
}

function peaksFromWavArrayBuffer(ab: ArrayBuffer, barCount: number): number[] | null {
  if (barCount <= 0 || ab.byteLength < 44) return null;

  const view = new DataView(ab);
  const riff = readFourCC(view, 0);
  const wave = readFourCC(view, 8);
  if (riff !== 'RIFF' || wave !== 'WAVE') return null;

  let offset = 12;
  let audioFormat = 1;
  let numChannels = 1;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= ab.byteLength) {
    const id = readFourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const chunkData = offset + 8;

    if (id === 'fmt ' && size >= 16) {
      audioFormat = view.getUint16(chunkData, true);
      numChannels = view.getUint16(chunkData + 2, true);
      bitsPerSample = view.getUint16(chunkData + 14, true);
    } else if (id === 'data') {
      dataOffset = chunkData;
      dataSize = size;
      break;
    }

    offset = chunkData + size + (size % 2);
  }

  // רק PCM אינטגרלי 16-bit
  if (dataOffset < 0 || audioFormat !== 1 || bitsPerSample !== 16 || numChannels < 1) {
    return null;
  }

  const bytesPerFrame = (bitsPerSample / 8) * numChannels;
  if (bytesPerFrame <= 0) return null;

  const totalFrames = Math.floor(dataSize / bytesPerFrame);
  if (totalFrames < 2) return null;

  const peaks = new Array(barCount).fill(0);
  const maxEnd = Math.min(ab.byteLength, dataOffset + dataSize);

  for (let i = 0; i < totalFrames; i++) {
    const bytePos = dataOffset + i * bytesPerFrame;
    if (bytePos + 2 > maxEnd) break;

    let framePeak = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const sampleOffset = bytePos + ch * 2;
      if (sampleOffset + 2 > maxEnd) break;
      const s = view.getInt16(sampleOffset, true);
      framePeak = Math.max(framePeak, Math.abs(s) / 32768);
    }

    const bar = Math.min(barCount - 1, Math.floor((i / totalFrames) * barCount));
    if (framePeak > peaks[bar]) peaks[bar] = framePeak;
  }

  // רצפת רעש נמוכה יחסית לפיק + gamma שמגביר mid-low
  const peakMax = Math.max(...peaks, 1e-6);
  const noiseFloor = peakMax * 0.015;
  const span = Math.max(1e-6, peakMax - noiseFloor);
  const shaped = peaks.map((p) => {
    const above = Math.max(0, Math.min(peakMax, p) - noiseFloor);
    return Math.pow(above / span, 0.42);
  });
  return normalizeWaveformSamples(shaped, barCount);
}

function readFourCC(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}
