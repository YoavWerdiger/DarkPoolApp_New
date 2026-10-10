/**
 * פורמט ערכים ליומן כלכלי: מפריד אלפים (למשל 1,000,000).
 * '%' מוצג רק לדוחות שהם שיעור/ריבית/ציפיות — לא ל-CPI ומשפחת מדדי מחירים.
 * שמור בסנכרון עם supabase/functions/_shared/economicNumberFormat.ts
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

/** מסיר סימן אחוז מהסיומת; משאיר K/M/B וכד' */
export function stripEconomicPercentSuffix(suffix: string): string {
  return suffix.replace(/[%٪]/g, '').replace(/\s+$/g, '');
}

/**
 * האם להציג '%' ליד הערך — לפי שם הדוח.
 *
 * עם %: אבטלה, ריבית, ציפיות אינפלציה, שכר שעתי (שינוי), צמיחת GDP, ושיעורים דומים.
 * בלי %: CPI/PCE/PPI (גם MoM/YoY), NFP/תביעות/JOLTS, PMI, אמון צרכנים, ספירות/רמות.
 */
export function shouldShowEconomicPercent(eventTitle?: string | null): boolean {
  if (!eventTitle) return false;
  const t = eventTitle.toLowerCase();

  // דוחות שינוי (MoM / YoY / QoQ, גם בעברית) — הערך הוא שינוי באחוזים: CPI/PPI/PCE,
  // מכירות קמעונאיות, דיור, הזמנות וכו׳. לפני רשימת «בלי %» שחוסמת משפחות לפי שם
  if (/\((mom|yoy|qoq|m\/m|y\/y|q\/q)\)|\b(mom|yoy|qoq)\b|\b(m\/m|y\/y|q\/q)\b/.test(t)) return true;
  if (/\((חודשי|שנתי|רבעוני)\)|חודש(י)? לחודש|שנה לשנה|רבעון לרבעון/.test(t)) return true;

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

  // עברית — בלי %
  if (
    /מדד המחירים|מדד מחירי|הוצאות הצריכה|מחירי היצרנ|תעסוקה לא.?חקלא|תביעות אבטלה|משרות פנויות|מכירות קמעונ|מוצרים עמיד|התחלות בנייה|היתרי בנייה|ביטחון צרכ|סנטימנט/.test(
      t,
    )
  ) {
    // אל תחסום "ציפיות אינפלציה" / "שיעור אבטלה"
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
    /gdp growth|growth rate|real gdp.*%|gdp.*(mom|qoq|yoy|q\/q|y\/y|m\/m)/,
    /\bgdp\b.*(qoq|yoy|q\/q|y\/y)/,
    /labor force participation|participation rate/,
    /capacity utilization/,
    /underemployment/,
  ];
  if (yesPercent.some((re) => re.test(t))) return true;

  // עברית — עם %
  if (/שיעור אבטלה|אבטלה|החלטת ריבית|ריבית הבסיס|ריבית הפד|ציפיות אינפלציה|שכר.*שעה|צמיחת תוצר|צמיחת gdp|שיעור השתתפות|ניצול קיבולת/.test(t)) {
    return true;
  }

  return false;
}

/** מחזיר מספר לצורך השוואות (תוצאה מול תחזית) — מתעלם מפסיקים וסיומות */
export function parseEconomicNumber(raw: string | undefined | null): number {
  if (raw == null) return NaN;
  const parts = splitNumericPrefix(String(raw));
  if (!parts) return NaN;
  return Number(parts.sign + parts.intFrac);
}

/**
 * תצוגה: פסיקים + ספרות לפי המקור.
 * תמיד מנרמל (מסיר '%' מהמקור); מוסיף '%' רק אם shouldShowEconomicPercent(title).
 */
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
