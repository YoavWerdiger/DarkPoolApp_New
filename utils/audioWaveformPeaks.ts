/**
 * חילוץ ויבפורם מפיקים אמיתיים של קובץ WAV (PCM),
 * ומיפוי metering חי (dBFS) לרמת 0–1 לצורך feedback בזמן הקלטה.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import {
  resampleWaveformSamples,
  WAVEFORM_STORE_BARS,
} from './waveformSamples';
import { logger } from './logger';

/** dBFS → 0–1 גולמי. העיצוב לתצוגה רק ב־shapeWaveformLevel. */
export function meteringDbToLevel(db: number): number {
  if (!Number.isFinite(db) || db <= -80) return 0;
  const MIN_DB = -48;
  const MAX_DB = -3;
  const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db));
  return (clamped - MIN_DB) / (MAX_DB - MIN_DB);
}

/**
 * בונה דגימות גולמיות לשמירה בהודעה (בלי shape — התצוגה מעצבת).
 * מעדיף את אותו envelope מההקלטה החיה כדי שיתאים לפריוויו;
 * WAV רק כשאין מספיק דגימות חיות.
 */
export async function resolveMessageWaveform(
  uri: string | null | undefined,
  liveSamples: number[],
  barCount: number = WAVEFORM_STORE_BARS,
): Promise<number[]> {
  if (liveSamples.length >= 8) {
    return resampleWaveformSamples(liveSamples, barCount);
  }

  if (uri) {
    const fromFile = await extractPeaksFromWavFile(uri, barCount);
    if (fromFile && fromFile.length >= 2) {
      return fromFile;
    }
  }

  return resampleWaveformSamples(liveSamples, barCount);
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

  // raw 0–1 — shape רק בתצוגה (normalizeWaveformSamples)
  return peaks;
}

function readFourCC(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}
