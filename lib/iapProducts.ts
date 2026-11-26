import { Platform } from 'react-native';

/**
 * רכישות בתוך האפליקציה: במובייל (iOS / Android) כל מכירה של תוכן דיגיטלי עוברת דרך
 * Apple / Google (הנחיה 3.1.1 של Apple, Payments policy של Google). CardCom נשאר רק לווב.
 *
 * חייב להתאים ל-IAP_PRODUCTS ב-supabase/functions/_shared/iap.ts ולמוצרים שהוקמו בחנויות.
 */
// Subscriptions go through Apple / Google on mobile.
export const IAP_ENABLED = Platform.OS === 'ios' || Platform.OS === 'android';
// The course stays on CardCom (redirect): Apple caps the ILS price below the course price and has no installments.
export const COURSE_IAP_ENABLED = false;

export const IAP_SUBSCRIPTION_SKUS: Record<string, string> = {
  monthly: 'com.darkpool.app.sub.monthly',
  quarterly: 'com.darkpool.app.sub.quarterly',
  yearly: 'com.darkpool.app.sub.yearly',
};

export const IAP_ONE_TIME_SKUS: Record<string, string> = {
  'course:whales-course-1': 'com.darkpool.app.course.whales',
};

export function skuForPlan(planId: string): { sku: string; type: 'subs' | 'in-app' } | null {
  if (IAP_SUBSCRIPTION_SKUS[planId]) return { sku: IAP_SUBSCRIPTION_SKUS[planId], type: 'subs' };
  if (IAP_ONE_TIME_SKUS[planId]) return { sku: IAP_ONE_TIME_SKUS[planId], type: 'in-app' };
  return null;
}

export function planForSku(sku: string): string | null {
  for (const [planId, s] of Object.entries({ ...IAP_SUBSCRIPTION_SKUS, ...IAP_ONE_TIME_SKUS })) {
    if (s === sku) return planId;
  }
  return null;
}
