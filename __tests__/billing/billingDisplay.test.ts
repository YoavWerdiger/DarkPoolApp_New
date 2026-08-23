import {
  formatCardBrandHe,
  formatCardLast4Mask,
  formatPaymentMethodLabel,
  formatPlanPriceHe,
  isPaidSubscriptionActive,
  resolveNextBilling,
  subscriptionStatusLabelHe,
} from '../../utils/billingDisplay';

describe('billingDisplay', () => {
  it('formats Visa last4 for the billing card', () => {
    expect(
      formatPaymentMethodLabel({ last4: '2596', brand: 'Visa', hasToken: true }),
    ).toBe('ויזה •••• 2596');
    expect(formatCardLast4Mask('2596')).toBe('•••• 2596');
  });

  it('falls back to saved card / unavailable without last4', () => {
    expect(formatPaymentMethodLabel({ hasToken: true })).toBe('כרטיס שמור לחיוב חוזר');
    expect(formatPaymentMethodLabel({})).toBe('לא זמין');
  });

  it('maps common card brands to Hebrew', () => {
    expect(formatCardBrandHe('Mastercard')).toBe('מאסטרקארד');
    expect(formatCardBrandHe('UnknownBank')).toBe('UnknownBank');
  });

  it('treats free active row as not a paid subscription', () => {
    expect(
      isPaidSubscriptionActive({
        planId: 'free',
        status: 'active',
        isPremium: false,
      }),
    ).toBe(false);
    expect(
      isPaidSubscriptionActive({
        planId: 'premium',
        status: 'active',
        isPremium: true,
      }),
    ).toBe(true);
    expect(
      isPaidSubscriptionActive({
        planId: 'premium',
        status: 'cancelled',
        isPremium: false,
      }),
    ).toBe(false);
  });

  it('uses expires_at as next billing when auto_renew is on', () => {
    const info = resolveNextBilling({
      expiresAt: '2026-09-09T21:34:31.625Z',
      autoRenew: true,
      isPaidActive: true,
      status: 'active',
    });
    expect(info?.hasDate).toBe(true);
    expect(info?.primary).toMatch(/^החיוב הבא ב־/);
    expect(info?.primary).toContain('2026');
    expect(info?.secondary).toMatch(/חידוש אוטומטי/);
  });

  it('does not invent a next charge for free users', () => {
    expect(
      resolveNextBilling({
        expiresAt: '2026-09-09T21:34:31.625Z',
        autoRenew: true,
        isPaidActive: false,
      }),
    ).toBeNull();
  });

  it('shows no next charge when subscription is inactive', () => {
    const cancelled = resolveNextBilling({
      expiresAt: '2026-09-09T21:34:31.625Z',
      autoRenew: true,
      isPaidActive: false,
      status: 'cancelled',
    });
    expect(cancelled?.hasDate).toBe(false);
    expect(cancelled?.primary).toBe('אין חיוב הבא');
    expect(cancelled?.secondary).toMatch(/בוטל/);

    const pastDue = resolveNextBilling({
      expiresAt: '2026-09-09T21:34:31.625Z',
      autoRenew: true,
      isPaidActive: false,
      status: 'past_due',
    });
    expect(pastDue?.primary).toBe('אין חיוב הבא');
    expect(pastDue?.secondary).toMatch(/מוגבל עד להסדרת התשלום/);
  });

  it('shows honest placeholder when paid but no expires_at yet', () => {
    const info = resolveNextBilling({
      expiresAt: null,
      autoRenew: true,
      isPaidActive: true,
      status: 'active',
    });
    expect(info?.primary).toBe('יעודכן לאחר החיוב הראשון');
    expect(info?.hasDate).toBe(false);
  });

  it('formats plan price and status labels', () => {
    expect(formatPlanPriceHe(399, 'quarterly')).toBe('₪399 / רבעון');
    expect(formatPlanPriceHe(1, 'monthly')).toBe('₪1 / חודש');
    expect(subscriptionStatusLabelHe('active', true)).toBe('פעיל');
    expect(subscriptionStatusLabelHe('past_due', false)).toBe('ממתין לתשלום');
    expect(subscriptionStatusLabelHe(null, false)).toBe('ללא מנוי בתשלום');
  });
});
