/** בניית נקודות SVG לגרף מיני (שימוש חוזר בכרטיסי גילוי). */
export function valuesToSparklinePoints(
  values: number[],
  w: number,
  h: number
): string {
  if (values.length < 2 || w <= 4 || h <= 4) return '';
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const parts: string[] = [];
  for (let i = 0; i < values.length; i++) {
    const t = i / (values.length - 1);
    const x = pad + t * (w - 2 * pad);
    const n = range < 1e-12 ? 0.5 : (values[i] - min) / range;
    const y = pad + (1 - n) * (h - 2 * pad);
    parts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return parts.join(' ');
}
