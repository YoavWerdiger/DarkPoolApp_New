/** עזרי ספי התראה מרובים לרשימת מעקב */

export function uniqSortedThresholds(values: number[]): number[] {
  const clean = values
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
  return Array.from(new Set(clean.map((n) => Number(n.toFixed(6))))).sort(
    (a, b) => a - b
  );
}

export function parseThresholdList(
  arr: unknown,
  legacy: unknown
): number[] {
  const fromArr = Array.isArray(arr)
    ? arr.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  if (fromArr.length > 0) return uniqSortedThresholds(fromArr);
  if (legacy != null && Number.isFinite(Number(legacy)) && Number(legacy) > 0) {
    return [Number(legacy)];
  }
  return [];
}

export function toggleThreshold(list: number[], value: number): number[] {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return list;
  const key = Number(v.toFixed(6));
  const has = list.some((n) => Number(n.toFixed(6)) === key);
  if (has) {
    return uniqSortedThresholds(list.filter((n) => Number(n.toFixed(6)) !== key));
  }
  return uniqSortedThresholds([...list, key]);
}

export function addThreshold(list: number[], value: number): number[] {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return list;
  return uniqSortedThresholds([...list, v]);
}

export function legacyFirst(list: number[]): number | null {
  return list.length > 0 ? list[0] : null;
}

export const ENTRY_GAIN_PRESETS = [3, 5, 8, 10, 15, 20];
export const ENTRY_LOSS_PRESETS = [3, 5, 8, 10];
export const DAILY_CHANGE_PRESETS = [2, 3, 5, 7];
export const PRICE_MOVE_PRESETS = [1, 2, 3, 5];
