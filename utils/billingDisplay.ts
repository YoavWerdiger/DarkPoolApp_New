import i18n from '../lib/i18n';
import { appLocale } from '../lib/i18n/locale';
/** Hebrew billing UI helpers — next charge, payment method, plan price labels. */

/** `user_subscriptions.status` values that are not billable / not in good standing. */
const INACTIVE_SUBSCRIPTION_STATUSES = new Set([
  'cancelled',
  'canceled',
  'expired',
  'past_due',
  'suspended',
]);

export function normalizeSubscriptionStatus(
  status: string | null | undefined,
): string | null {
  if (!status) return null;
  const s = String(status).trim().toLowerCase();
  return s || null;
}

/** Paid plan that is currently active (billable / in good standing). */
export function isPaidSubscriptionActive(opts: {
  planId?: string | null;
  status?: string | null;
  isPremium?: boolean;
}): boolean {
  const planId = opts.planId ?? null;
  if (!planId || planId === 'free') return false;
  const status = normalizeSubscriptionStatus(opts.status);
  if (status === 'active') return true;
  // Fallback when only users.subscription_* is available (webhook lag)
  if (status == null && opts.isPremium) return true;
  return false;
}

export function isInactiveSubscriptionStatus(
  status: string | null | undefined,
): boolean {
  const s = normalizeSubscriptionStatus(status);
  return s != null && INACTIVE_SUBSCRIPTION_STATUSES.has(s);
}

export function formatBillingDateHe(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(appLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatCardBrandHe(brand: string | null | undefined): string {
  const raw = (brand || '').trim();
  if (!raw) return i18n.t('auto.utils__billingDisplay.s1');
  const b = raw.toLowerCase();
  if (b.includes('visa')) return i18n.t('auto.utils__billingDisplay.s2');
  if (b.includes('master')) return i18n.t('auto.utils__billingDisplay.s3');
  if (b.includes('amex') || b.includes('american')) return i18n.t('auto.utils__billingDisplay.s4');
  if (b.includes('isra')) return i18n.t('auto.utils__billingDisplay.s5');
  if (b.includes('diners')) return i18n.t('auto.utils__billingDisplay.s6');
  return raw;
}

export function normalizeCardLast4(last4?: string | null): string | null {
  const digits = String(last4 || '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export function formatCardLast4Mask(last4?: string | null): string | null {
  const n = normalizeCardLast4(last4);
  return n ? `•••• ${n}` : null;
}

export function formatPaymentMethodLabel(opts: {
  last4?: string | null;
  brand?: string | null;
  hasToken?: boolean;
}): string {
  const last4 = normalizeCardLast4(opts.last4);
  if (last4) {
    return `${formatCardBrandHe(opts.brand)} •••• ${last4}`;
  }
  if (opts.hasToken) return i18n.t('auto.utils__billingDisplay.s7');
  return i18n.t('auto.utils__billingDisplay.s8');
}

export type NextBillingInfo = {
  /** Main line shown to the user */
  primary: string;
  /** Optional supporting line */
  secondary: string | null;
  /** True when we have a concrete calendar date for the next cycle */
  hasDate: boolean;
};

function inactiveNextBillingCopy(status: string): NextBillingInfo {
  switch (status) {
    case 'past_due':
      return {
        primary: i18n.t('auto.utils__billingDisplay.s9'),
        secondary: i18n.t('auto.utils__billingDisplay.s10'),
        hasDate: false,
      };
    case 'expired':
      return {
        primary: i18n.t('auto.utils__billingDisplay.s9'),
        secondary: i18n.t('auto.utils__billingDisplay.s11'),
        hasDate: false,
      };
    case 'cancelled':
    case 'canceled':
      return {
        primary: i18n.t('auto.utils__billingDisplay.s9'),
        secondary: i18n.t('auto.utils__billingDisplay.s12'),
        hasDate: false,
      };
    case 'suspended':
      return {
        primary: i18n.t('auto.utils__billingDisplay.s9'),
        secondary: i18n.t('auto.utils__billingDisplay.s13'),
        hasDate: false,
      };
    default:
      return {
        primary: i18n.t('auto.utils__billingDisplay.s9'),
        secondary: i18n.t('auto.utils__billingDisplay.s14'),
        hasDate: false,
      };
  }
}

/**
 * Next billing / period end for a paid subscription.
 * Source of truth in DB: `user_subscriptions.expires_at` (+ `auto_renew` + `status`).
 * There is no separate `next_billing_at` column.
 *
 * Active + auto-renew → concrete next charge date.
 * Inactive / past_due / cancelled / expired → no next charge + access limited until payment.
 */
export function resolveNextBilling(opts: {
  expiresAt?: string | null;
  autoRenew?: boolean | null;
  isPaidActive: boolean;
  status?: string | null;
}): NextBillingInfo | null {
  const status = normalizeSubscriptionStatus(opts.status);

  if (status && INACTIVE_SUBSCRIPTION_STATUSES.has(status)) {
    return inactiveNextBillingCopy(status);
  }

  if (!opts.isPaidActive) return null;

  const dateLabel = formatBillingDateHe(opts.expiresAt);

  if (opts.autoRenew && dateLabel) {
    return {
      primary: i18n.t('auto.utils__billingDisplay.s15', { v0: dateLabel }),
      secondary: i18n.t('auto.utils__billingDisplay.s16'),
      hasDate: true,
    };
  }

  if (!opts.autoRenew && dateLabel) {
    return {
      primary: i18n.t('auto.utils__billingDisplay.s17', { v0: dateLabel }),
      secondary: i18n.t('auto.utils__billingDisplay.s18'),
      hasDate: false,
    };
  }

  return {
    primary: i18n.t('auto.utils__billingDisplay.s19'),
    secondary: i18n.t('auto.utils__billingDisplay.s20'),
    hasDate: false,
  };
}

export function formatPlanPriceHe(
  price: number | null | undefined,
  period: string | null | undefined,
): string | null {
  if (price == null || Number.isNaN(Number(price))) return null;
  const amount = Number(price);
  const periodHe =
    period === 'yearly'
      ? i18n.t('auto.utils__billingDisplay.s21')
      : period === 'quarterly'
        ? i18n.t('auto.utils__billingDisplay.s22')
        : period === 'one_time'
          ? i18n.t('auto.utils__billingDisplay.s23')
          : i18n.t('auto.utils__billingDisplay.s24');
  return `₪${amount} / ${periodHe.replace(/^ל/, '')}`;
}

export function subscriptionStatusLabelHe(
  status: string | null | undefined,
  isPremium: boolean,
): string {
  const s = normalizeSubscriptionStatus(status);
  if (s === 'active') return i18n.t('auto.utils__billingDisplay.s25');
  if (s === 'cancelled' || s === 'canceled') return i18n.t('auto.utils__billingDisplay.s26');
  if (s === 'expired') return i18n.t('auto.utils__billingDisplay.s27');
  if (s === 'past_due') return i18n.t('auto.utils__billingDisplay.s28');
  if (s === 'suspended') return i18n.t('auto.utils__billingDisplay.s29');
  if (isPremium) return i18n.t('auto.utils__billingDisplay.s25');
  return i18n.t('auto.utils__billingDisplay.s30');
}
