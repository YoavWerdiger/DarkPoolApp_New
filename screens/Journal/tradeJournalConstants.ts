/** ערכים שנשמרים ב־journal_details (JSONB) — תואמים ל־Supabase */

export type TradeTimeframe = 'scalp' | 'day' | 'swing';

export const TIMEFRAME_OPTIONS: { id: TradeTimeframe; label: string }[] = [
  { id: 'scalp', label: 'סקאלפ' },
  { id: 'day', label: 'יומי' },
  { id: 'swing', label: 'סווינג' },
];

export type MoodId = 'calm' | 'stressed' | 'tired' | 'focused' | 'anxious' | 'euphoric' | 'other';

export const MOOD_OPTIONS: { id: MoodId; label: string }[] = [
  { id: 'calm', label: 'רגוע' },
  { id: 'focused', label: 'ממוקד' },
  { id: 'stressed', label: 'לחוץ' },
  { id: 'anxious', label: 'חרד' },
  { id: 'tired', label: 'עייף' },
  { id: 'euphoric', label: 'אופורי' },
  { id: 'other', label: 'אחר' },
];

export const MISTAKE_OPTIONS: { id: string; label: string }[] = [
  { id: 'early_exit', label: 'יציאה מוקדמת מדי' },
  { id: 'wrong_size', label: 'גודל פוזיציה לא מתאים' },
  { id: 'no_plan_entry', label: 'כניסה בלי תוכנית' },
  { id: 'fomo', label: 'FOMO' },
  { id: 'ignored_stop', label: 'לא עמדתי בסטופ' },
  { id: 'chased', label: 'רדפתי אחרי המחיר' },
  { id: 'revenge', label: 'מסחר נקמה' },
  { id: 'overtraded', label: 'יותר מדי עסקאות' },
];

export type TradeJournalDetails = {
  timeframe?: TradeTimeframe | null;
  mood_before?: MoodId | null;
  mood_after?: MoodId | null;
  followed_plan?: boolean | null;
  strategy_type?: string | null;
  entry_reason?: string | null;
  exit_reason?: string | null;
  mistakes?: string[];
};

export function parseJournalDetails(raw: unknown): TradeJournalDetails {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  let followed: boolean | null = null;
  if (typeof o.followed_plan === 'boolean') followed = o.followed_plan;
  else if (o.followed_plan === 'true') followed = true;
  else if (o.followed_plan === 'false') followed = false;

  return {
    timeframe: (o.timeframe as TradeTimeframe) ?? null,
    mood_before: (o.mood_before as MoodId) ?? null,
    mood_after: (o.mood_after as MoodId) ?? null,
    followed_plan: followed,
    strategy_type: typeof o.strategy_type === 'string' ? o.strategy_type : null,
    entry_reason: typeof o.entry_reason === 'string' ? o.entry_reason : null,
    exit_reason: typeof o.exit_reason === 'string' ? o.exit_reason : null,
    mistakes: Array.isArray(o.mistakes) ? o.mistakes.filter((x): x is string => typeof x === 'string') : [],
  };
}

export function moodLabel(id: MoodId | null | undefined): string {
  if (!id) return '—';
  return MOOD_OPTIONS.find((m) => m.id === id)?.label ?? id;
}

export function timeframeLabel(id: TradeTimeframe | null | undefined): string {
  if (!id) return '—';
  return TIMEFRAME_OPTIONS.find((t) => t.id === id)?.label ?? id;
}

/** משך בין כניסה ליציאה — טקסט קצר בעברית */
export function formatTradeDurationHebrew(entryIso: string, exitIso: string): string {
  const a = new Date(entryIso).getTime();
  const b = new Date(exitIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return '—';
  let ms = b - a;
  const days = Math.floor(ms / 86400000);
  ms -= days * 86400000;
  const hours = Math.floor(ms / 3600000);
  ms -= hours * 3600000;
  const mins = Math.floor(ms / 60000);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ימים`);
  if (hours > 0) parts.push(`${hours} שעות`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins} דק׳`);
  return parts.join(', ');
}

/** רצף ניצחונות/הפסדים ברצף עד הטרייד הזה (לפי exit_date כרונולוגי) */
export function streakAtTrade(allTrades: { id: string; exit_date: string; pnl: number }[], tradeId: string): string {
  const sorted = [...allTrades].sort(
    (x, y) => new Date(x.exit_date).getTime() - new Date(y.exit_date).getTime()
  );
  const idx = sorted.findIndex((t) => t.id === tradeId);
  if (idx < 0) return '—';
  const pnl = sorted[idx].pnl;
  if (pnl === 0) return 'ניטרלי';
  const win = pnl > 0;
  let n = 1;
  for (let i = idx - 1; i >= 0; i--) {
    const p = sorted[i].pnl;
    if (p === 0) break;
    if ((p > 0) === win) n++;
    else break;
  }
  return win ? `${n} ניצחונות ברצף` : `${n} הפסדים ברצף`;
}
