/**
 * קאש «מצב אחרון» ליומן המסחר — כניסה אופטימיסטית בלי שלבי טעינה:
 * התיק, הסיכום, האחזקות, סדרת הגרף והעסקאות של כל תיק נשמרים בזיכרון (סינכרוני — כניסה חוזרת
 * באותה הפעלה בלי שום שלד) ול-AsyncStorage (הפעלה הבאה — נטען תוך רגע, לפני הרשת).
 * הרשת ממשיכה לרענן ברקע ומעדכנת את הקאש.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Portfolio, PortfolioHolding, PortfolioSummary, Trade } from '../../screens/Portfolios/portfolioTypes';

export type JournalSnapshot = {
  portfolio?: Portfolio;
  summary?: PortfolioSummary | null;
  holdings?: PortfolioHolding[];
  /** סדרת שווי התיק לגרף (כמו ב-OverviewTab) */
  chartSeries?: { date: string; value: number; external_flow?: number }[];
  closedTrades?: Trade[];
  openTrades?: Trade[];
  savedAt?: number;
};

const PREFIX = 'journal:snapshot:v1:';
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const SAVE_DEBOUNCE_MS = 1200;

const memory = new Map<string, JournalSnapshot>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** מצב אחרון מהזיכרון — סינכרוני, לאתחול state */
export function getJournalSnapshot(portfolioId: string): JournalSnapshot | undefined {
  return memory.get(portfolioId);
}

/** טוען מהדיסק לזיכרון (פעם אחת לתיק) ומחזיר את המצב השמור */
export async function loadJournalSnapshot(portfolioId: string): Promise<JournalSnapshot | undefined> {
  const mem = memory.get(portfolioId);
  if (mem) return mem;
  try {
    const raw = await AsyncStorage.getItem(PREFIX + portfolioId);
    if (!raw) return undefined;
    const snap = JSON.parse(raw) as JournalSnapshot;
    if (!snap?.savedAt || Date.now() - snap.savedAt > MAX_AGE_MS) return undefined;
    // ייתכן שהרשת כתבה בינתיים — לא דורסים
    const now = memory.get(portfolioId);
    if (now) return now;
    memory.set(portfolioId, snap);
    return snap;
  } catch {
    return undefined;
  }
}

/** מעדכן חלק מהמצב (מיזוג) — בזיכרון מיד, לדיסק ב-debounce */
export function saveJournalSnapshot(portfolioId: string, patch: JournalSnapshot): void {
  if (!portfolioId) return;
  const next = { ...memory.get(portfolioId), ...patch, savedAt: Date.now() };
  memory.set(portfolioId, next);
  const prev = timers.get(portfolioId);
  if (prev) clearTimeout(prev);
  timers.set(
    portfolioId,
    setTimeout(() => {
      timers.delete(portfolioId);
      AsyncStorage.setItem(PREFIX + portfolioId, JSON.stringify(memory.get(portfolioId))).catch(() => undefined);
    }, SAVE_DEBOUNCE_MS),
  );
}

/* ── רשימת התיקים + התיק האחרון (מסך היומן נפתח ישר על התיק) ── */

const LIST_KEY = 'journal:portfolios:v1';
type JournalPortfolioList = { portfolios: Portfolio[]; selectedId: string | null };
let listMemory: JournalPortfolioList | null = null;

export function getJournalPortfolioList(): JournalPortfolioList | null {
  return listMemory;
}

export async function loadJournalPortfolioList() {
  if (listMemory) return listMemory;
  try {
    const raw = await AsyncStorage.getItem(LIST_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as JournalPortfolioList | null;
    if (!listMemory && v && Array.isArray(v.portfolios)) listMemory = v;
    return listMemory as JournalPortfolioList | null;
  } catch {
    return null;
  }
}

export function saveJournalPortfolioList(portfolios: Portfolio[], selectedId: string | null) {
  listMemory = { portfolios, selectedId };
  AsyncStorage.setItem(LIST_KEY, JSON.stringify(listMemory)).catch(() => undefined);
}
