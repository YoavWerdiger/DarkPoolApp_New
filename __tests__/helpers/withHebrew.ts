import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * טסטים שבודקים טקסט בקוד נכתבו לפני העברת המחרוזות ל-i18n (lib/i18n/locales/he.auto.json).
 * withHebrew מחזיר את הקוד כשכל i18n.t('auto.x.y') מוחלף בערך העברי שלו — כך אותן בדיקות
 * («label: 'סקר'», title="פיד עסקאות") ממשיכות לבדוק את אותו טקסט שהמשתמש רואה.
 */
const he: Record<string, Record<string, string>> = JSON.parse(
  readFileSync(join(__dirname, '../../lib/i18n/locales/he.auto.json'), 'utf8'),
);

function lookup(fullKey: string): string | null {
  const m = fullKey.match(/^auto\.([^.]+)\.(.+)$/);
  if (!m) return null;
  return he[m[1]]?.[m[2]] ?? null;
}

const quote = (v: string) => v.replace(/'/g, "\\'");

export function withHebrew(src: string): string {
  const prefix = src.match(/const K = ['"`](auto\.[^.'"`]+\.)['"`]/)?.[1] ?? null;
  const KEY = String.raw`(?:['"\`](auto\.[\w]+\.[\w]+)['"\`]|K \+ ['"\`]([\w]+)['"\`])`;
  const resolve = (full?: string, short?: string) =>
    full ? lookup(full) : prefix && short ? lookup(prefix + short) : null;
  // JSX: title={i18n.t('…')} → title="ערך"
  let out = src.replace(new RegExp(String.raw`=\{\s*i18n\.t\(\s*${KEY}\s*\)\s*\}`, 'g'), (all, full, short) => {
    const v = resolve(full, short);
    return v == null ? all : `="${v}"`;
  });
  // ביטוי: i18n.t('…') → 'ערך'
  out = out.replace(new RegExp(String.raw`i18n\.t\(\s*${KEY}\s*(?:,[^)]*)?\)`, 'g'), (all, full, short) => {
    const v = resolve(full, short);
    return v == null ? all : `'${quote(v)}'`;
  });
  return out;
}

export function readWithHebrew(path: string): string {
  return withHebrew(readFileSync(path, 'utf8'));
}
