/** מספר ברים לתצוגה בבועה / פריוויו — צר יותר (WhatsApp-like) */
export const WAVEFORM_DISPLAY_BARS = 32;

/** מספר samples לשמירה בהודעה — מספיק כדי לשמור loud/soft לאורך הזמן */
export const WAVEFORM_STORE_BARS = 48;

/**
 * עיצוב תצוגה משותף — חי + בועה.
 * קצת פחות רגיש: רצפה/שקט גבוהים יותר, gamma > 1, תקרת פלט נמוכה יותר.
 */
export const WAVEFORM_SILENCE = 0.055;
export const WAVEFORM_FLOOR = 0.14;
export const WAVEFORM_GAMMA = 1.08;
export const WAVEFORM_OUT_MIN = 0.05;
export const WAVEFORM_OUT_SPAN = 0.75;

/**
 * רמה בודדת 0–1 → גובה בר לתצוגה.
 * אותה נוסחה ל־VoiceWaveform חי ולבועה אחרי resample.
 */
export function shapeWaveformLevel(raw: number): number {
  const v = Math.max(0, Math.min(1, Number(raw) || 0));
  if (v < WAVEFORM_SILENCE) return 0;
  const span = Math.max(1e-6, 1 - WAVEFORM_FLOOR);
  const above = Math.max(0, v - WAVEFORM_FLOOR);
  const n = Math.pow(above / span, WAVEFORM_GAMMA);
  return Math.min(1, WAVEFORM_OUT_MIN + n * WAVEFORM_OUT_SPAN);
}

/**
 * דגימות רציפות → N ברים (peak / stretch) — בלי עיצוב תצוגה.
 * לשמירה: raw levels; לתצוגה: אחר כך shapeWaveformLevel.
 */
export function resampleWaveformSamples(samples: number[], targetCount: number): number[] {
  if (targetCount <= 0) return [];

  if (samples.length === 0) {
    return Array(targetCount).fill(0);
  }

  if (samples.length === targetCount) {
    return samples.map((v) => Math.max(0, Math.min(1, Number(v) || 0)));
  }

  if (samples.length < targetCount) {
    if (samples.length === 1) {
      const v = Math.max(0, Math.min(1, Number(samples[0]) || 0));
      return Array(targetCount).fill(v);
    }
    const result: number[] = [];
    const last = samples.length - 1;
    for (let i = 0; i < targetCount; i++) {
      const pos = (i / (targetCount - 1)) * last;
      const lo = Math.floor(pos);
      const hi = Math.min(last, Math.ceil(pos));
      const t = pos - lo;
      const v = samples[lo] * (1 - t) + samples[hi] * t;
      result.push(Math.max(0, Math.min(1, v)));
    }
    return result;
  }

  const result: number[] = [];
  const windowSize = samples.length / targetCount;

  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * windowSize);
    const end = Math.max(start + 1, Math.floor((i + 1) * windowSize));
    let peak = 0;
    for (let j = start; j < end && j < samples.length; j++) {
      const v = Number(samples[j]) || 0;
      if (v > peak) peak = v;
    }
    result.push(Math.max(0, Math.min(1, peak)));
  }

  return result;
}

/**
 * לתצוגה: resample + shapeWaveformLevel (אותו עיצוב כמו ההקלטה החיה).
 */
export function normalizeWaveformSamples(samples: number[], targetCount: number): number[] {
  if (targetCount <= 0) return [];
  if (samples.length === 0) {
    return Array(targetCount).fill(WAVEFORM_OUT_MIN);
  }
  return resampleWaveformSamples(samples, targetCount).map(shapeWaveformLevel);
}

export function flatWaveformBars(count: number): number[] {
  return Array(count).fill(0.1);
}

function coerceWaveformArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const nums = value.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  return nums.length >= 2 ? nums : undefined;
}

/**
 * חילוץ דגימות ויבפורם מ־metadata ו/או content JSON של הודעת אודיו.
 * תומך ב־waveform / waveformData וגם ב־caption שמכיל JSON מקונן.
 */
export function extractWaveformData(message: {
  content?: string | null;
  metadata?: { waveformData?: number[]; waveform?: number[]; [key: string]: unknown } | null;
}): number[] | undefined {
  const fromMeta =
    coerceWaveformArray(message.metadata?.waveformData) ??
    coerceWaveformArray(message.metadata?.waveform);
  if (fromMeta) return fromMeta;

  const raw = message.content?.trim();
  if (!raw || !raw.startsWith('{')) return undefined;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const direct =
      coerceWaveformArray(parsed.waveformData) ?? coerceWaveformArray(parsed.waveform);
    if (direct) return direct;

    const caption = parsed.caption;
    if (typeof caption === 'string' && caption.trim().startsWith('{')) {
      try {
        const nested = JSON.parse(caption) as Record<string, unknown>;
        return (
          coerceWaveformArray(nested.waveformData) ?? coerceWaveformArray(nested.waveform)
        );
      } catch {
        /* ignore nested */
      }
    }
  } catch {
    /* not JSON */
  }

  return undefined;
}
