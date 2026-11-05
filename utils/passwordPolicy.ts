import i18n from '../lib/i18n';
/**
 * מדיניות סיסמה אחידה לכל האפליקציה (רישום, איפוס, שינוי סיסמה).
 * בהשראת הפלטפורמות המובילות (Google / Microsoft / NIST 800-63B):
 * - לפחות 8 תווים
 * - לפחות אות אחת ומספר אחד (סימן מיוחד — מומלץ, לא חובה)
 * - לא סיסמה נפוצה/מנוחשת ולא זהה לאימייל
 * - בלי רווחים בהתחלה/בסוף (מונע טעויות העתקה)
 */

export const PASSWORD_MIN_LENGTH = 8;

const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234',
  'password', 'password1', 'password123', 'passw0rd', 'qwerty123', 'qwertyui', 'qwerty12',
  'abc12345', 'abcd1234', '1q2w3e4r', '1qaz2wsx', 'iloveyou1', 'welcome1', 'admin123',
  'letmein1', 'aa123456', 'a1234567', 'asdf1234', 'zxcvbnm1', 'darkpool1', 'darkpool123',
]);

export type PasswordRuleKey = 'length' | 'letterAndNumber' | 'notCommon';

export type PasswordCheck = {
  key: PasswordRuleKey;
  label: string;
  passed: boolean;
};

export function checkPassword(password: string, email?: string | null): PasswordCheck[] {
  const p = password ?? '';
  const lower = p.toLowerCase();
  const emailLocal = (email ?? '').split('@')[0]?.toLowerCase() ?? '';
  const isCommon =
    COMMON_PASSWORDS.has(lower) ||
    /^(.)\1+$/.test(p) || // אותו תו חוזר
    (emailLocal.length >= 4 && (lower === emailLocal || lower.includes(emailLocal)));
  return [
    { key: 'length', label: i18n.t('auto.utils__passwordPolicy.s1', { v0: PASSWORD_MIN_LENGTH }), passed: p.length >= PASSWORD_MIN_LENGTH },
    {
      key: 'letterAndNumber',
      label: i18n.t('auto.utils__passwordPolicy.s2'),
      passed: /[A-Za-z֐-׿]/.test(p) && /\d/.test(p),
    },
    { key: 'notCommon', label: i18n.t('auto.utils__passwordPolicy.s3'), passed: p.length > 0 && !isCommon },
  ];
}

export function isPasswordValid(password: string, email?: string | null): boolean {
  if (!password || password !== password.trim()) return false;
  return checkPassword(password, email).every((c) => c.passed);
}

/** הודעת שגיאה קצרה לתנאי הראשון שלא מתקיים */
export function passwordErrorMessage(password: string, email?: string | null): string | null {
  if (password && password !== password.trim()) return i18n.t('auto.utils__passwordPolicy.s4');
  const failed = checkPassword(password, email).find((c) => !c.passed);
  if (!failed) return null;
  switch (failed.key) {
    case 'length':
      return i18n.t('auto.utils__passwordPolicy.s5', { v0: PASSWORD_MIN_LENGTH });
    case 'letterAndNumber':
      return i18n.t('auto.utils__passwordPolicy.s6');
    case 'notCommon':
      return i18n.t('auto.utils__passwordPolicy.s7');
  }
}
