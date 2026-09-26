/**
 * כיתוב כנה לכרטיסי גילוי — בלי "$ copied" ובלי תשואת תיק משוחזרת.
 */

import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { toDataIsland } from './bidi';
import { formatReturnPct } from './congressTradeDisplay';
import { formatUsdCompact } from './darkPoolFormat';

/** מספר עוקבים אמיתי בלבד. 0 / לא-מספר → אין שורה. */
export function formatFollowerCountHe(count: number | null | undefined): string | null {
  if (count == null || !Number.isFinite(count) || count <= 0) return null;
  const n = Math.floor(count);
  if (n === 1) return 'עוקב אחד';
  if (n === 2) return 'שני עוקבים';
  return `${toDataIsland(n)} עוקבים`;
}

/** מונה דיווחים אמיתיים — לא Win Rate ולא "$ copied". */
export function formatTradeCountHe(count: number | null | undefined): string | null {
  if (count == null || !Number.isFinite(count) || count <= 0) return null;
  const n = Math.floor(count);
  if (n === 1) return 'עסקה מדווחת אחת';
  if (n === 2) return 'שתי עסקאות מדווחות';
  return `${toDataIsland(n)} עסקאות מדווחות`;
}

/**
 * שווי פוזיציות 13F מדווחות בלבד.
 * אסור לקרוא לזה על פוליטיקאי — STOCK Act הוא טווח, לא AUM.
 */
export function formatReported13fValueHe(
  usd: number | null | undefined
): string | null {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return null;
  const label = formatUsdCompact(usd);
  if (!label || label === '—') return null;
  return toDataIsland(label);
}

export function partitionExploreByKind(people: ExplorePerson[]): {
  politicians: ExplorePerson[];
  insiders: ExplorePerson[];
  funds: ExplorePerson[];
} {
  const politicians: ExplorePerson[] = [];
  const insiders: ExplorePerson[] = [];
  const funds: ExplorePerson[] = [];
  for (const person of people) {
    if (person.kind === 'politician') politicians.push(person);
    else if (person.kind === 'insider') insiders.push(person);
    else if (person.kind === 'fund_manager') funds.push(person);
  }
  return { politicians, insiders, funds };
}

export function takeUniqueExplorePeople(
  people: ExplorePerson[],
  limit: number
): ExplorePerson[] {
  const map = new Map<string, ExplorePerson>();
  for (const person of people) {
    const id = person.id?.trim();
    if (!id || map.has(id)) continue;
    map.set(id, person);
    if (map.size >= limit) break;
  }
  return Array.from(map.values());
}

export function sortExploreByLastFiled<T extends { last_filed_at?: string | null }>(
  a: T,
  b: T
): number {
  return String(b.last_filed_at ?? '').localeCompare(String(a.last_filed_at ?? ''));
}

/** חציון ExcessReturn של Quiver — לא TWR / לא ALL +3051%. */
export function formatMedianExcessMetric(
  pct: number | null | undefined
): string | null {
  return formatReturnPct(pct);
}

export function isReturnMetric(metric: string | undefined): boolean {
  return !!metric && metric.includes('%');
}

export function isNegativeReturnMetric(metric: string | undefined): boolean {
  return isReturnMetric(metric) && /-\d/.test(metric);
}
