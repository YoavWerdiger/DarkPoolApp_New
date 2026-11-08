/**
 * שדות סכום: פסיקי אלפים תוך כדי הקלדה (1000000 → 1,000,000) ופענוח על המספר הנקי (QA 9.4).
 * שומר נקודה עשרונית אחת והספרות שאחריה כפי שהוקלדו (כולל «12.» באמצע הקלדה).
 */
export function formatThousandsInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (!cleaned) return '';
  const dot = cleaned.indexOf('.');
  const intRaw = dot === -1 ? cleaned : cleaned.slice(0, dot);
  const frac = dot === -1 ? null : cleaned.slice(dot + 1).replace(/\./g, '');
  const intPart = intRaw.replace(/^0+(?=\d)/, '');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac === null ? grouped : `${grouped || '0'}.${frac}`;
}

/** «1,000,000.50» → 1000000.5; ריק/לא תקין → NaN */
export function parseFormattedNumber(value: string): number {
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return NaN;
  return Number(cleaned);
}
