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
  return d.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatCardBrandHe(brand: string | null | undefined): string {
  const raw = (brand || '').trim();
  if (!raw) return 'כרטיס';
  const b = raw.toLowerCase();
  if (b.includes('visa')) return 'ויזה';
  if (b.includes('master')) return 'מאסטרקארד';
  if (b.includes('amex') || b.includes('american')) return 'אמריקן אקספרס';
  if (b.includes('isra')) return 'ישראכרט';
  if (b.includes('diners')) return 'דיינרס';
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
  if (opts.hasToken) return 'כרטיס שמור לחיוב חוזר';
  return 'לא זמין';
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
        primary: 'אין חיוב הבא',
        secondary: 'המנוי מוגבל עד להסדרת התשלום',
        hasDate: false,
      };
    case 'expired':
      return {
        primary: 'אין חיוב הבא',
        secondary: 'המנוי פג תוקף — הגישה מוגבלת עד לתשלום',
        hasDate: false,
      };
    case 'cancelled':
    case 'canceled':
      return {
        primary: 'אין חיוב הבא',
        secondary: 'המנוי בוטל — הגישה מוגבלת עד לתשלום מחדש',
        hasDate: false,
      };
    case 'suspended':
      return {
        primary: 'אין חיוב הבא',
        secondary: 'החשבון מושעה עד לתשלום',
        hasDate: false,
      };
    default:
      return {
        primary: 'אין חיוב הבא',
        secondary: 'הגישה מוגבלת עד לתשלום',
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
      primary: `החיוב הבא ב־${dateLabel}`,
      secondary: 'חידוש אוטומטי בתום התקופה הנוכחית',
      hasDate: true,
    };
  }

  if (!opts.autoRenew && dateLabel) {
    return {
      primary: `המנוי בתוקף עד ${dateLabel}`,
      secondary: 'אין חיוב מתוזמן — חידוש אוטומטי כבוי',
      hasDate: false,
    };
  }

  return {
    primary: 'יעודכן לאחר החיוב הראשון',
    secondary: 'מועד החיוב יופיע כאן אחרי אישור התשלום במערכת',
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
      ? 'לשנה'
      : period === 'quarterly'
        ? 'לרבעון'
        : period === 'one_time'
          ? 'חד־פעמי'
          : 'לחודש';
  return `₪${amount} / ${periodHe.replace(/^ל/, '')}`;
}

export function subscriptionStatusLabelHe(
  status: string | null | undefined,
  isPremium: boolean,
): string {
  const s = normalizeSubscriptionStatus(status);
  if (s === 'active') return 'פעיל';
  if (s === 'cancelled' || s === 'canceled') return 'בוטל';
  if (s === 'expired') return 'פג תוקף';
  if (s === 'past_due') return 'ממתין לתשלום';
  if (s === 'suspended') return 'מושעה';
  if (isPremium) return 'פעיל';
  return 'ללא מנוי בתשלום';
}
