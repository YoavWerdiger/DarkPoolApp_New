/**
 * פורמט ערכים ליומן כלכלי — שמור בסנכרון עם utils/economicNumberFormat.ts
 * '%' רק לשיעורים/ריבית/ציפיות; לא ל-CPI ומשפחת מדדי מחירים.
 */

function splitNumericPrefix(raw: string): { sign: string; intFrac: string; suffix: string } | null {
  const s = raw.trim();
  if (!s) return null;

  let sign = '';
  let i = 0;
  if (s[0] === '+' || s[0] === '-') {
    sign = s[0];
    i = 1;
  }

  let sawDot = false;
  const start = i;
  while (i < s.length) {
    const c = s[i];
    if (c >= '0' && c <= '9') {
      i++;
      continue;
    }
    if (c === ',') {
      i++;
      continue;
    }
    if (c === '.' && !sawDot) {
      sawDot = true;
      i++;
      continue;
    }
    break;
  }

  if (i === start) return null;

  const intFrac = s.slice(start, i).replace(/,/g, '');
  const suffix = s.slice(i);
  return { sign, intFrac, suffix };
}

export function stripEconomicPercentSuffix(suffix: string): string {
  return suffix.replace(/[%٪]/g, '').replace(/\s+$/g, '');
}

export function shouldShowEconomicPercent(eventTitle?: string | null): boolean {
  if (!eventTitle) return false;
  const t = eventTitle.toLowerCase();

  const noPercent = [
    /\bcpi\b/,
    /consumer price/,
    /\bpce\b/,
    /personal consumption/,
    /\bppi\b/,
    /producer price/,
    /\bpmi\b/,
    /\bism\b/,
    /s&p global/,
    /consumer confidence/,
    /consumer sentiment/,
    /michigan sentiment/,
    /nahb/,
    /nonfarm|non-farm|nfp\b/,
    /payroll/,
    /jobless claims|initial claims|continuing claims/,
    /\bjolts\b/,
    /job openings/,
    /retail sales/,
    /durable goods/,
    /housing starts|building permits|home sales|existing home|new home/,
    /trade balance|trade deficit/,
    /factory orders|industrial production/,
    /crude oil|api crude|eia /,
    /adp\b/,
  ];
  if (noPercent.some((re) => re.test(t))) return false;

  if (
    /מדד המחירים|מדד מחירי|הוצאות הצריכה|מחירי היצרנ|תעסוקה לא.?חקלא|תביעות אבטלה|משרות פנויות|מכירות קמעונ|מוצרים עמיד|התחלות בנייה|היתרי בנייה|ביטחון צרכ|סנטימנט/.test(
      t,
    )
  ) {
    if (!/ציפיות|אבטלה|ריבית/.test(t)) return false;
  }

  const yesPercent = [
    /unemployment/,
    /u-?6\b/,
    /interest rate/,
    /fed funds|federal funds/,
    /fomc.*rate|rate decision|cash rate|bank rate|refi rate|repo rate/,
    /inflation expectation/,
    /michigan.*inflation|uom.*inflation|u\.?of.?m.*inflation/,
    /average hourly earnings|avg hourly earnings|hourly earnings/,
    /gdp growth|growth rate/,
    /\bgdp\b.*(qoq|yoy|q\/q|y\/y|mom|m\/m)/,
    /labor force participation|participation rate/,
    /capacity utilization/,
    /underemployment/,
  ];
  if (yesPercent.some((re) => re.test(t))) return true;

  if (/שיעור אבטלה|אבטלה|החלטת ריבית|ריבית הבסיס|ריבית הפד|ציפיות אינפלציה|שכר.*שעה|צמיחת תוצר|צמיחת gdp|שיעור השתתפות|ניצול קיבולת/.test(t)) {
    return true;
  }

  return false;
}

export function formatEconomicDisplayValue(
  raw: string | undefined | null,
  eventTitle?: string | null,
): string {
  if (raw == null) return '';
  const s = String(raw);
  const parts = splitNumericPrefix(s);
  if (!parts) {
    return stripEconomicPercentSuffix(s.trim());
  }

  const { sign, intFrac, suffix } = parts;
  if (intFrac === '' || intFrac === '.') {
    return stripEconomicPercentSuffix(s.trim());
  }

  const n = Number(sign + intFrac);
  if (!isFinite(n)) {
    return stripEconomicPercentSuffix(s.trim());
  }

  const fracLen = intFrac.includes('.') ? intFrac.split('.')[1]?.length ?? 0 : 0;
  const maxFrac = Math.min(8, fracLen);

  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  });

  const cleanedSuffix = stripEconomicPercentSuffix(suffix);
  const base = formatted + cleanedSuffix;
  if (!base) return '';
  return shouldShowEconomicPercent(eventTitle) ? `${base}%` : base;
}
