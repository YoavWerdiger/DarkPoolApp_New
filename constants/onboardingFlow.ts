/**
 * Fine-grained onboarding progress (one screen ≈ one task).
 * Keep in sync with OnboardingNavigator route order.
 */

/**
 * SMS verification during registration. Off until Twilio compliance approval lands.
 *
 * Flipping this to `true` is the whole switch: RegistrationPhoneScreen sends the OTP
 * and routes through RegistrationPhoneVerification, and the progress indicator counts
 * the extra step. Nothing else in the app needs editing.
 *
 * The Supabase dashboard side (Twilio credentials, SMS provider) must be live first —
 * see docs/PHONE_OTP_SETUP.md.
 */
export const PHONE_VERIFICATION_ENABLED = false;

const STEP_ORDER = [
  'name',
  'phone',
  ...(PHONE_VERIFICATION_ENABLED ? (['phoneVerification'] as const) : []),
  'email',
  'emailVerification',
  'password',
  'profileImage',
  'age',
  'experience',
  'tradingFocus',
  'platform',
  'portfolio',
  'track',
  'summary',
] as const;

export type OnboardingStepKey =
  | 'name'
  | 'phone'
  | 'phoneVerification'
  | 'email'
  | 'emailVerification'
  | 'password'
  | 'profileImage'
  | 'age'
  | 'experience'
  | 'tradingFocus'
  | 'platform'
  | 'portfolio'
  | 'track'
  | 'summary';

export const ONBOARDING_TOTAL_STEPS = STEP_ORDER.length;

export const ONBOARDING_STEPS: Record<OnboardingStepKey, number> = (() => {
  const steps = {} as Record<OnboardingStepKey, number>;
  STEP_ORDER.forEach((key, index) => {
    steps[key] = index + 1;
  });
  // The verification screen stays mounted in the navigator while disabled, so it still
  // needs a number to render; it borrows email's rather than pushing the count.
  if (!PHONE_VERIFICATION_ENABLED) steps.phoneVerification = steps.email;
  return steps;
})();
