import i18n from '../../lib/i18n';
/** ערכים שנשמרים ב־journal_details (JSONB) — תואמים ל־Supabase */

export type TradeTimeframe = 'scalp' | 'day' | 'swing';

export const TIMEFRAME_OPTIONS: { id: TradeTimeframe; label: string }[] = [
  { id: 'scalp', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s1') },
  { id: 'day', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s2') },
  { id: 'swing', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s3') },
];

export type MoodId = 'calm' | 'stressed' | 'tired' | 'focused' | 'anxious' | 'euphoric' | 'other';

export const MOOD_OPTIONS: { id: MoodId; label: string }[] = [
  { id: 'calm', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s4') },
  { id: 'focused', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s5') },
  { id: 'stressed', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s6') },
  { id: 'anxious', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s7') },
  { id: 'tired', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s8') },
  { id: 'euphoric', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s9') },
  { id: 'other', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s10') },
];

export const MISTAKE_OPTIONS: { id: string; label: string }[] = [
  { id: 'early_exit', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s11') },
  { id: 'wrong_size', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s12') },
  { id: 'no_plan_entry', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s13') },
  { id: 'fomo', label: 'FOMO' },
  { id: 'ignored_stop', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s14') },
  { id: 'chased', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s15') },
  { id: 'revenge', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s16') },
  { id: 'overtraded', label: i18n.t('auto.screens__Journal__tradeJournalConstants.s17') },
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
  if (days > 0) parts.push(i18n.t('auto.screens__Journal__tradeJournalConstants.s18', { v0: days }));
  if (hours > 0) parts.push(i18n.t('auto.screens__Journal__tradeJournalConstants.s19', { v0: hours }));
  if (mins > 0 || parts.length === 0) parts.push(i18n.t('auto.screens__Journal__tradeJournalConstants.s20', { v0: mins }));
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
  if (pnl === 0) return i18n.t('auto.screens__Journal__tradeJournalConstants.s21');
  const win = pnl > 0;
  let n = 1;
  for (let i = idx - 1; i >= 0; i--) {
    const p = sorted[i].pnl;
    if (p === 0) break;
    if ((p > 0) === win) n++;
    else break;
  }
  return win ? i18n.t('auto.screens__Journal__tradeJournalConstants.s22', { v0: n }) : i18n.t('auto.screens__Journal__tradeJournalConstants.s23', { v0: n });
}
