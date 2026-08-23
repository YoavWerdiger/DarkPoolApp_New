/**
 * טקסונומיית דגלים לאירועי מאקרו ארה״ב:
 * 🔴 high = אדום (טייר 1) · 🟠 medium = כתום (טייר 2)
 * שמור בסנכרון עם supabase/functions/_shared/economicEventImportance.ts
 */

export type EconomicImportance = 'high' | 'medium' | 'low';
export type EconomicFlagTier = 'red' | 'orange';

function normalizeEventText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/["״׳']/g, '')
    .replace(/[_./\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function isExcludedCpiVariant(t: string): boolean {
  return (
    t.includes('cpi energy') ||
    t.includes('cpi food') ||
    t.includes('import price') ||
    t.includes('export price') ||
    t.includes('מדד מחירי אנרגיה') ||
    t.includes('מדד מחירי מזון')
  );
}

/** ציפיות אינפלציה (UoM וכו') — כתום, לא אדום. */
function isInflationExpectations(t: string): boolean {
  return includesAny(t, [
    'inflation expectation',
    'ציפיות אינפלציה',
    'ציפיות האינפלציה',
    'ציפיות אינפלצ',
  ]);
}

/** נאום יו״ר הפד (אדום) — לפני "חבר פד מדבר" (כתום). */
function isFedChairPowellSpeech(t: string): boolean {
  if (includesAny(t, ['powell', 'פאוול'])) return true;
  if (
    (t.includes('fed chair') || t.includes('chair of the fed') || t.includes('יו"ר הפד') || t.includes('יו״ר הפד') || t.includes('יור הפד')) &&
    (t.includes('speak') || t.includes('speech') || t.includes('נאום'))
  ) {
    return true;
  }
  return (
    (t.includes('נאום') && (t.includes('יור הפד') || t.includes('יו"ר הפד') || t.includes('יו״ר הפד') || t.includes('פאוול'))) ||
    false
  );
}

function isFomcMemberSpeech(t: string): boolean {
  if (isFedChairPowellSpeech(t)) return false;
  if (t.includes('fomc member') && (t.includes('speak') || t.includes('speech'))) return true;
  if (t.includes('נאום') && t.includes('חבר') && t.includes('פד')) return true;
  // Fed X Speaks / Speech — לא Powell/Chair, לא statement/minutes/press
  if (t.includes('fomc') && (t.includes('speak') || t.includes('speech'))) return true;
  if (
    (t.includes('fed ') || t.startsWith('fed') || t.includes(' הפד') || t.includes('פד ')) &&
    (t.includes('speak') || t.includes('speech') || t.includes('נאום'))
  ) {
    if (t.includes('statement') || t.includes('minutes') || t.includes('press conference') || t.includes('הודעת') || t.includes('פרוטוקול')) {
      return false;
    }
    return true;
  }
  return false;
}

function isRedTier(t: string): boolean {
  // אינפלציה — ליבה לפני כותרת; מדלגים על רכיבי CPI צרים ועל ציפיות (כתום)
  if (!isExcludedCpiVariant(t) && !isInflationExpectations(t)) {
    if (includesAny(t, ['core cpi', 'cpi core', 'מדד המחירים לצרכן ליבה', 'cpi ליבה'])) return true;
    if (includesAny(t, ['core pce', 'pce core', 'מדד מחירי הצריכה ליבה', 'pce ליבה'])) return true;
    if (includesAny(t, ['core ppi', 'ppi core', 'מדד המחירים ליצרן ליבה', 'ppi ליבה'])) return true;
    if (
      includesAny(t, ['consumer price index', 'מדד המחירים לצרכן']) ||
      (/\bcpi\b/.test(t) && !t.includes('core'))
    ) {
      return true;
    }
    if (
      includesAny(t, ['pce price', 'personal consumption expenditures price', 'מדד מחירי הצריכה', 'מדד הוצאות הצריכה']) ||
      (/\bpce\b/.test(t) && (t.includes('price') || t.includes('index') || t.includes('מדד')))
    ) {
      return true;
    }
    if (
      includesAny(t, ['producer price index', 'מדד המחירים ליצרן', 'מדד מחירי יצרן', 'מדד מחירי היצרנים']) ||
      (/\bppi\b/.test(t) && !t.includes('core'))
    ) {
      return true;
    }
    // שיעור אינפלציה / Inflation Rate (לא ציפיות)
    if (
      includesAny(t, [
        'inflation rate',
        'core inflation',
        'headline inflation',
        'שיעור אינפלציה',
        'שיעור האינפלציה',
        'אינפלציה ליבה',
      ]) ||
      (/\binflation\b/.test(t) && !t.includes('expectation')) ||
      (t.includes('אינפלצ') && !t.includes('ציפיות'))
    ) {
      return true;
    }
  }

  // תעסוקה (לא ADP)
  if (t.includes('adp')) {
    // ADP מטופל בכתום
  } else if (
    includesAny(t, [
      'nonfarm payroll',
      'non farm payroll',
      'non-farm payroll',
      'nonfarm payrolls',
      'non farm payrolls',
      'non-farm payrolls',
      'דוח התעסוקה',
      'תעסוקה לא חקלאית',
      'תעסוקה לא-חקלאית',
    ]) ||
    /\bnfp\b/.test(t)
  ) {
    return true;
  }

  if (includesAny(t, ['unemployment rate', 'שיעור האבטלה', 'שיעור אבטלה'])) return true;
  if (includesAny(t, ['average hourly earnings', 'hourly earnings', 'השכר הממוצע לשעה', 'שכר ממוצע לשעה', 'שכר לשעה'])) {
    return true;
  }
  if (
    includesAny(t, ['jolts job openings', 'job openings', 'משרות הפנויות', 'מספר המשרות הפנויות', 'משרות פנויות']) ||
    (t.includes('jolts') && t.includes('opening'))
  ) {
    return true;
  }

  // פד / FOMC — אירועי ליבה
  if (
    includesAny(t, [
      'interest rate decision',
      'federal funds rate',
      'fed funds rate',
      'fomc rate',
      'החלטת הריבית',
      'החלטת ריבית',
    ])
  ) {
    return true;
  }
  if (includesAny(t, ['fomc statement', 'הודעת הפד', 'הצהרת הפד'])) return true;
  if (
    includesAny(t, ['fomc press conference', 'מסיבת העיתונאים של הפד', 'מסיבת העיתונאים', 'מסיבת עיתונאים']) ||
    ((t.includes('press conference') || t.includes('מסיבת')) && (t.includes('fomc') || t.includes('fed') || t.includes('פד')))
  ) {
    return true;
  }
  if (includesAny(t, ['fomc meeting minutes', 'fomc minutes', 'פרוטוקול הפד', 'פרוטוקול ישיבת הפד'])) {
    return true;
  }
  if (isFedChairPowellSpeech(t)) return true;

  // צמיחה / סנטימנט / צריכה
  if (
    includesAny(t, ['gross domestic product', 'התמ"ג', 'התמ״ג', 'תמ"ג', 'תמ״ג']) ||
    (/\bgdp\b/.test(t) && !t.includes('price index') && !t.includes('deflator'))
  ) {
    return true;
  }
  // רק ISM PMI ראשי — לא רכיבי משנה ולא S&P/Chicago PMI
  if (
    includesAny(t, ['ism manufacturing pmi', 'מדד מנהלי הרכש בתעשייה']) ||
    (t.includes('ism') && t.includes('manufacturing') && t.includes('pmi') &&
      !includesAny(t, ['employment', 'prices', 'new orders']))
  ) {
    return true;
  }
  if (
    includesAny(t, [
      'ism services pmi',
      'ism non manufacturing pmi',
      'ism non-manufacturing pmi',
      'מדד מנהלי הרכש בשירותים',
    ]) ||
    (t.includes('ism') &&
      (t.includes('services') || t.includes('non manufacturing') || t.includes('non-manufacturing')) &&
      t.includes('pmi') &&
      !includesAny(t, ['employment', 'prices', 'new orders']))
  ) {
    return true;
  }
  if (includesAny(t, ['core retail sales', 'retail sales', 'מכירות קמעונאיות'])) return true;
  if (
    includesAny(t, [
      'cb consumer confidence',
      'conference board consumer confidence',
      'consumer confidence',
      'אמון הצרכנים',
      'אמון צרכנים',
      'אמון צרכן',
    ]) &&
    !includesAny(t, ['michigan', 'uom', 'u. of m', 'university of michigan', 'מישיגן'])
  ) {
    return true;
  }

  return false;
}

function isOrangeTier(t: string): boolean {
  if (includesAny(t, ['adp', 'דוח התעסוקה adp'])) return true;
  if (includesAny(t, ['initial jobless claims', 'jobless claims', 'תביעות ראשוניות', 'תביעות אבטלה'])) {
    return true;
  }
  if (
    includesAny(t, [
      'michigan consumer sentiment',
      'uom consumer sentiment',
      'university of michigan consumer sentiment',
      'u. of mich',
      'סנטימנט הצרכנים של אוניברסיטת מישיגן',
      'סנטימנט צרכן מישיגן',
      'סנטימנט מישיגן',
    ])
  ) {
    return true;
  }
  // ציפיות אינפלציה (UoM / Michigan / תרגום עברי מקוצר בלי "מישיגן")
  if (isInflationExpectations(t)) return true;

  if (includesAny(t, ['durable goods', 'הזמנות מוצרים בני קיימא', 'הזמנות סחורות מתינות'])) return true;
  if (isFomcMemberSpeech(t)) return true;

  return false;
}

/** מחזיר red/orange אם הכותרת/סוג תואמים לטקסונומיה; אחרת null. */
export function matchEconomicFlagTier(...parts: Array<string | null | undefined>): EconomicFlagTier | null {
  const t = normalizeEventText(parts.filter(Boolean).join(' '));
  if (!t) return null;
  // אדום לפני כתום (Powell לפני Member Speaks)
  if (isRedTier(t)) return 'red';
  if (isOrangeTier(t)) return 'orange';
  return null;
}

/**
 * ממפה ל-high/medium לפי טקסונומיה.
 * מחוץ לרשימה — משאיר את ה-fallback (חשיבות ספק / קיימת).
 */
export function resolveEconomicEventImportance(
  titleOrType: string,
  fallback: EconomicImportance = 'low',
  ...extraParts: Array<string | null | undefined>
): EconomicImportance {
  const tier = matchEconomicFlagTier(titleOrType, ...extraParts);
  if (tier === 'red') return 'high';
  if (tier === 'orange') return 'medium';
  return fallback;
}

export function isTaxonomyFlaggedEvent(...parts: Array<string | null | undefined>): boolean {
  return matchEconomicFlagTier(...parts) != null;
}
