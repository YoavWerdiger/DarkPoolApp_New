/**
 * סנאפשוט תוך-יום אמיתי (ברי Yahoo של שעה) במקום נקודת סגירה אחת להיום.
 * לא ממציא מחירים: בלי לפחות שני ברי שעה הסדרה היומית נשארת.
 */

export interface SessionBar {
  date: string;
  close: number;
}

export interface WeightedSessionLeg {
  weight: number;
  bars: SessionBar[];
}

export interface OpenSessionPosition {
  symbol: string;
  direction: string;
  entryPrice: number;
  quantity: number;
  leverage: number | null;
  previousClose: number | null;
}

function sessionDay(bars: SessionBar[]): string | null {
  const timed = bars.filter((b) => b.close > 0 && /T\d{2}:/.test(b.date));
  if (!timed.length) return null;
  return timed[timed.length - 1].date.slice(0, 10);
}

function priceAt(bars: SessionBar[], iso: string): number | null {
  const hit = bars.find((b) => b.date === iso);
  return hit && hit.close > 0 ? hit.close : null;
}

/** נתיב שווי: משקל מדווח × יחס מול מחיר הייחוס של אותו רגל. */
export function appendWeightedSession<T extends { date: string; value: number }>(
  series: T[],
  legs: WeightedSessionLeg[]
): T[] {
  const usable = legs.filter((l) => l.weight > 0 && l.bars.some((b) => b.close > 0 && /T/.test(b.date)));
  if (!series.length || usable.length < 1) return series;

  const stamps = Array.from(
    new Set(usable.flatMap((l) => l.bars.filter((b) => /T\d{2}:/.test(b.date)).map((b) => b.date)))
  ).sort();
  if (stamps.length < 2) return series;

  const day = stamps[stamps.length - 1].slice(0, 10);
  const history = series.filter((p) => p.date.slice(0, 10) < day);
  const base = history[history.length - 1] ?? series[series.length - 1];
  if (!(base.value > 0)) return series;

  const refs = usable.map((leg) => {
    const prior = [...leg.bars]
      .filter((b) => b.close > 0 && b.date.slice(0, 10) <= base.date.slice(0, 10))
      .sort((a, b) => a.date.localeCompare(b.date));
    const ref = prior.length ? prior[prior.length - 1].close : leg.bars.find((b) => b.close > 0)?.close;
    return ref != null && ref > 0 ? ref : null;
  });

  const weightSum = usable.reduce((s, l, i) => (refs[i] ? s + l.weight : s), 0);
  if (!(weightSum > 0)) return series;

  const tail: T[] = [];
  const lastPx: Array<number | null> = refs.slice();
  for (const stamp of stamps) {
    if (stamp.slice(0, 10) < day) continue;
    let acc = 0;
    let covered = 0;
    usable.forEach((leg, i) => {
      const ref = refs[i];
      if (!(ref && ref > 0)) return;
      const px = priceAt(leg.bars, stamp);
      if (px != null) lastPx[i] = px;
      const use = lastPx[i];
      if (!(use && use > 0)) return;
      acc += leg.weight * (use / ref);
      covered += leg.weight;
    });
    if (covered / weightSum < 0.8) continue;
    tail.push({ ...base, date: stamp, value: base.value * (acc / weightSum) });
  }
  if (tail.length < 2) return series;
  return [...history, ...tail];
}

/**
 * כמו appendWeightedSession אבל לכמה ימים (1W / 1M): מחליף את הנקודות היומיות בחלון
 * בברים תוך-יומיים. כל יום משורשר לנקודה היומית של היום הקודם בסדרה — היחס של כל רגל
 * הוא מול הבר האחרון שלה ביום הקודם (כך סוף כל יום ≈ הסגירה היומית, בלי קפיצות).
 * ביום הראשון בחלון — מול הבר הראשון שלו (פער הפתיחה של אותו יום לא נמדד).
 * לא ממציא מחירים: יום בלי כיסוי של 80% מהמשקל נשאר עם הנקודה היומית שלו.
 */
export function appendWeightedIntraday<T extends { date: string; value: number }>(
  series: T[],
  legs: WeightedSessionLeg[]
): T[] {
  const usable = legs
    .filter((l) => l.weight > 0)
    .map((l) => ({
      weight: l.weight,
      bars: l.bars
        .filter((b) => b.close > 0 && /T\d{2}:/.test(b.date))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .filter((l) => l.bars.length > 0);
  if (!series.length || !usable.length) return series;
  const weightSum = usable.reduce((s, l) => s + l.weight, 0);

  const stamps = Array.from(new Set(usable.flatMap((l) => l.bars.map((b) => b.date)))).sort();
  if (stamps.length < 2) return series;
  const days = Array.from(new Set(stamps.map((s) => s.slice(0, 10)))).sort();
  const daily = series.filter((p) => !/T\d{2}:/.test(p.date));

  // מחיר כל רגל לכל חותמת (ממשיך את האחרון הידוע)
  const byLeg = usable.map((l) => new Map(l.bars.map((b) => [b.date, b.close])));
  const tail: T[] = [];
  const replacedDays = new Set<string>();
  const lastPx: Array<number | null> = usable.map(() => null);
  for (const day of days) {
    const prior = daily.filter((p) => p.date.slice(0, 10) < day);
    const base = prior[prior.length - 1];
    if (!base || !(base.value > 0)) {
      // אין נקודה יומית לפני — מעדכנים רק את המחיר האחרון של כל רגל
      for (const st of stamps) if (st.slice(0, 10) === day) usable.forEach((_, i) => {
        const px = byLeg[i].get(st);
        if (px != null) lastPx[i] = px;
      });
      continue;
    }
    const daysStamps = stamps.filter((st) => st.slice(0, 10) === day);
    // ייחוס: הבר האחרון של אתמול (בתוך החלון) — אחרת הבר הראשון של היום
    const refs = usable.map((_, i) => lastPx[i] ?? (daysStamps.map((st) => byLeg[i].get(st)).find((v) => v != null) ?? null));
    const dayPoints: T[] = [];
    for (const st of daysStamps) {
      let acc = 0;
      let covered = 0;
      usable.forEach((l, i) => {
        const px = byLeg[i].get(st);
        if (px != null) lastPx[i] = px;
        const ref = refs[i];
        const use = lastPx[i];
        if (!(ref && ref > 0) || !(use && use > 0)) return;
        acc += l.weight * (use / ref);
        covered += l.weight;
      });
      if (covered / weightSum < 0.8) continue;
      dayPoints.push({ ...base, date: st, value: base.value * (acc / covered), external_flow: undefined } as T);
    }
    if (dayPoints.length >= 2) {
      // כסף שנכנס/יצא באותו יום (קנייה/מכירה) נשמר על הנקודה האחרונה — אחרת התשואה סופרת אותו כרווח
      const flow = daily.find((p) => p.date.slice(0, 10) === day) as (T & { external_flow?: number }) | undefined;
      if (flow?.external_flow) {
        (dayPoints[dayPoints.length - 1] as T & { external_flow?: number }).external_flow = flow.external_flow;
      }
      tail.push(...dayPoints);
      replacedDays.add(day);
    }
  }
  if (tail.length < 2) return series;
  const kept = series.filter((p) => !replacedDays.has(p.date.slice(0, 10)));
  return [...kept, ...tail].sort((a, b) => a.date.localeCompare(b.date));
}

function positionMark(positions: OpenSessionPosition[], priceOf: (symbol: string) => number | null): number {
  let sum = 0;
  for (const p of positions) {
    const px = priceOf(p.symbol);
    if (!(px && px > 0) || !(p.quantity > 0) || !(p.entryPrice > 0)) continue;
    const lev = p.leverage != null && p.leverage > 0 ? p.leverage : 1;
    const unrealized =
      p.direction === 'short'
        ? (p.entryPrice - px) * p.quantity * lev
        : (px - p.entryPrice) * p.quantity * lev;
    sum += p.entryPrice * p.quantity + unrealized;
  }
  return sum;
}

/**
 * מוסיף לתיק את תנועת הפוזיציות הפתוחות לפי ברי שעה.
 * הבסיס הוא הסנאפשוט היומי האחרון לפני יום הסשן — הדלתא היא שינוי מחיר אמיתי.
 */
export function appendOpenPositionSession<T extends { date: string; value: number }>(
  series: T[],
  positions: OpenSessionPosition[],
  hourlyBySymbol: Record<string, SessionBar[]>
): T[] {
  if (!series.length || !positions.length) return series;
  const barsBySym = new Map<string, SessionBar[]>();
  for (const p of positions) {
    const bars = (hourlyBySymbol[p.symbol.toUpperCase()] ?? []).filter(
      (b) => b.close > 0 && /T\d{2}:/.test(b.date)
    );
    if (bars.length) barsBySym.set(p.symbol.toUpperCase(), bars);
  }
  if (!barsBySym.size) return series;

  const stamps = Array.from(
    new Set(Array.from(barsBySym.values()).flatMap((bars) => bars.map((b) => b.date)))
  ).sort();
  if (stamps.length < 2) return series;
  const day = sessionDay(Array.from(barsBySym.values()).flat()) ?? stamps[stamps.length - 1].slice(0, 10);
  const history = series.filter((p) => p.date.slice(0, 10) < day);
  const base = history[history.length - 1] ?? series[series.length - 1];
  if (!(base.value > 0)) return series;

  const lastPx = new Map<string, number>();
  for (const p of positions) {
    const sym = p.symbol.toUpperCase();
    if (p.previousClose != null && p.previousClose > 0) lastPx.set(sym, p.previousClose);
  }
  const refMark = positionMark(positions, (sym) => lastPx.get(sym.toUpperCase()) ?? null);
  if (!(refMark > 0)) return series;

  const tail: T[] = [];
  for (const stamp of stamps) {
    if (stamp.slice(0, 10) < day) continue;
    for (const [sym, bars] of barsBySym) {
      const px = priceAt(bars, stamp);
      if (px != null) lastPx.set(sym, px);
    }
    const mark = positionMark(positions, (sym) => lastPx.get(sym.toUpperCase()) ?? null);
    if (!(mark > 0)) continue;
    tail.push({ ...base, date: stamp, value: base.value + (mark - refMark) });
  }
  if (tail.length < 2) return series;
  return [...history, ...tail];
}
