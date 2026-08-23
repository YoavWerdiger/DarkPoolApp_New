/**
 * One place that decides what a phone number looks like.
 *
 * Supabase Auth only accepts E.164 (`+972541234567`); `public.users.phone` stores the
 * digits the user typed. Both used to be derived ad hoc at each call site, which let
 * `972541234567` become `+972972541234567` and let the same number be stored under
 * several spellings, making the uniqueness check meaningless.
 */

/** Israeli mobile/landline national numbers are 8–9 digits after the leading 0. */
const IL_NATIONAL = /^[1-9][0-9]{7,8}$/;

export const PHONE_MIN_DIGITS = 10;
export const PHONE_MAX_DIGITS = 15;

/** Everything that is not a digit removed; `+` included, so callers must not rely on it. */
export function phoneDigits(input: string | null | undefined): string {
  if (input == null) return '';
  return String(input).replace(/[^\d]/g, '');
}

/**
 * Canonical E.164, assuming Israel when no country code is present.
 * Returns null when the input cannot be a real number rather than guessing.
 */
export function toE164(input: string | null | undefined): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  const digits = phoneDigits(raw);
  if (!digits) return null;

  // Already international: trust the country code the user gave us.
  if (raw.startsWith('+')) {
    return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS
      ? `+${digits}`
      : null;
  }

  // 972541234567 / 00972541234567 — country code present without the plus.
  const withoutIddPrefix = digits.startsWith('00') ? digits.slice(2) : digits;
  if (withoutIddPrefix.startsWith('972')) {
    const national = withoutIddPrefix.slice(3);
    return IL_NATIONAL.test(national) ? `+972${national}` : null;
  }

  // 0541234567 — Israeli national format.
  if (withoutIddPrefix.startsWith('0')) {
    const national = withoutIddPrefix.slice(1);
    return IL_NATIONAL.test(national) ? `+972${national}` : null;
  }

  // 541234567 — Israeli number typed without its leading zero.
  if (IL_NATIONAL.test(withoutIddPrefix)) {
    return `+972${withoutIddPrefix}`;
  }

  // Some other country typed without a plus; only accept a plausible length.
  return withoutIddPrefix.length >= PHONE_MIN_DIGITS &&
    withoutIddPrefix.length <= PHONE_MAX_DIGITS
    ? `+${withoutIddPrefix}`
    : null;
}

/** True when the input can be turned into a number Supabase Auth would accept. */
export function isValidPhone(input: string | null | undefined): boolean {
  return toE164(input) !== null;
}

/** `+972541234567` → `+9725*****67`; for logs and "we sent a code to…" copy. */
export function maskPhone(input: string | null | undefined): string {
  const e164 = toE164(input) ?? String(input ?? '');
  if (e164.length <= 6) return '****';
  return `${e164.slice(0, 5)}${'*'.repeat(Math.max(0, e164.length - 7))}${e164.slice(-2)}`;
}

/** Last digits for "we sent a code to *****1234" copy. */
export function phoneLastDigits(input: string | null | undefined, count = 4): string {
  const digits = phoneDigits(toE164(input) ?? input);
  return digits.slice(-count);
}
