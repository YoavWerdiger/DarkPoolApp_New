/** מספר ברים לתצוגה בבועה / פריוויו */
export const WAVEFORM_DISPLAY_BARS = 46;

/** מספר samples לשמירה בהודעה — מספיק כדי לשמור loud/soft לאורך הזמן */
export const WAVEFORM_STORE_BARS = 48;

/**
 * דגימות רציפות → N ברים.
 * הקטנה: peak envelope (לא ממוצע) — שומר רגעי דיבור חזקים/חלשים.
 * הגדלה: מתיחה לינארית על כל הרוחב — לא ריפוד באפסים.
 */
export function normalizeWaveformSamples(samples: number[], targetCount: number): number[] {
  if (targetCount <= 0) return [];

  if (samples.length === 0) {
    return Array(targetCount).fill(0.08);
  }

  if (samples.length === targetCount) {
    return normalizeWaveformRange(samples);
  }

  if (samples.length < targetCount) {
    if (samples.length === 1) {
      return normalizeWaveformRange(Array(targetCount).fill(samples[0]));
    }
    const result: number[] = [];
    const last = samples.length - 1;
    for (let i = 0; i < targetCount; i++) {
      const pos = (i / (targetCount - 1)) * last;
      const lo = Math.floor(pos);
      const hi = Math.min(last, Math.ceil(pos));
      const t = pos - lo;
      result.push(samples[lo] * (1 - t) + samples[hi] * t);
    }
    return normalizeWaveformRange(result);
  }

  const result: number[] = [];
  const windowSize = samples.length / targetCount;

  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * windowSize);
    const end = Math.max(start + 1, Math.floor((i + 1) * windowSize));
    let peak = 0;
    for (let j = start; j < end && j < samples.length; j++) {
      if (samples[j] > peak) peak = samples[j];
    }
    result.push(peak);
  }

  return normalizeWaveformRange(result);
}

/**
 * נרמול לתצוגה — רגיש לדיבור רך בלי למחוק ניגודיות loud/soft.
 * רצפת רעש נמוכה + gamma שמגביר mid-low, טווח פלט רחב.
 */
function normalizeWaveformRange(values: number[]): number[] {
  const maxVal = Math.max(...values);
  if (maxVal <= 0.012) {
    return values.map(() => 0.06);
  }

  // רצפה יחסית נמוכה — לא בולעת דיבור רך
  const floor = maxVal * 0.018;
  const span = Math.max(1e-6, maxVal - floor);

  return values.map((v) => {
    const above = Math.max(0, v - floor);
    // ~0.5 מגביר mid-low בלי לשטח פיקים גבוהים
    const n = Math.pow(above / span, 0.48);
    return Math.max(0.05, Math.min(1, 0.05 + n * 0.95));
  });
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
