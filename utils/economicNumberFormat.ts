/**
 * פורמט ערכים ליומן כלכלי: מפריד אלפים (למשל 1,000,000) תוך שמירה על סיומות כמו %, K, M.
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

/** מחזיר מספר לצורך השוואות (תוצאה מול תחזית) — מתעלם מפסיקים וסיומות */
export function parseEconomicNumber(raw: string | undefined | null): number {
  if (raw == null) return NaN;
  const parts = splitNumericPrefix(String(raw));
  if (!parts) return NaN;
  const n = Number(parts.sign + parts.intFrac);
  return n;
}

/**
 * תצוגה: פסיקים כל שלוש ספרות (מקל en-US), ספרות עשרוניות לפי המקור (עד 6).
 */
export function formatEconomicDisplayValue(raw: string | undefined | null): string {
  if (raw == null) return '';
  const s = String(raw);
  const parts = splitNumericPrefix(s);
  if (!parts) return s.trim();

  const { sign, intFrac, suffix } = parts;
  if (intFrac === '' || intFrac === '.') return s.trim();

  const n = Number(sign + intFrac);
  if (!isFinite(n)) return s.trim();

  const fracLen = intFrac.includes('.') ? intFrac.split('.')[1]?.length ?? 0 : 0;
  const maxFrac = Math.min(8, fracLen);

  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  });

  return formatted + suffix;
}
