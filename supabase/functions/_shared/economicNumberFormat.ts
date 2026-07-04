/**
 * פורמט ערכים ליומן כלכלי — שמור בסנכרון עם utils/economicNumberFormat.ts
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
