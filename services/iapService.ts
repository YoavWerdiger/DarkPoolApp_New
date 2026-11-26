import { Platform } from 'react-native';
import {
  deepLinkToSubscriptions,
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
  type PurchaseError,
} from 'expo-iap';
import { supabase } from './supabase';
import { logger } from '../utils/logger';
import { IAP_ENABLED, IAP_ONE_TIME_SKUS, IAP_SUBSCRIPTION_SKUS, planForSku, skuForPlan } from '../lib/iapProducts';

export type IapVerifyResult = {
  ok: boolean;
  entitled: boolean;
  status?: 'active' | 'expired' | 'revoked' | 'pending' | 'grace';
  planId?: string;
  expiresAt?: string | null;
  error?: string;
};

export type IapPurchaseOutcome =
  | { kind: 'success'; planId: string; expiresAt: string | null }
  | { kind: 'pending' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

export type StorePrice = { sku: string; displayPrice: string; offerToken?: string | null };

const TAG = 'iapService';

let connectPromise: Promise<boolean> | null = null;
let listenersStarted = false;
const waiters = new Map<string, (o: IapPurchaseOutcome) => void>();
const handledIds = new Set<string>();
const priceCache = new Map<string, StorePrice>();

function ensureConnection(): Promise<boolean> {
  if (!IAP_ENABLED) return Promise.resolve(false);
  if (!connectPromise) {
    connectPromise = initConnection().then(
      () => true,
      (e) => {
        logger.error(TAG, 'initConnection failed', e);
        connectPromise = null;
        return false;
      },
    );
  }
  return connectPromise;
}

/** שולח את הרכישה לאימות בשרת (iap-verify). */
async function verifyOnServer(p: Purchase): Promise<IapVerifyResult> {
  const body =
    Platform.OS === 'ios'
      ? { platform: 'ios', transactionId: p.id }
      : { platform: 'android', purchaseToken: p.purchaseToken, productId: p.productId };
  const { data, error } = await supabase.functions.invoke('iap-verify', { body });
  if (error) {
    // 409 — הרכישה שייכת לחשבון אחר
    const status = (error as { context?: { status?: number } }).context?.status;
    return { ok: false, entitled: false, error: status === 409 ? 'owned_by_other_account' : error.message };
  }
  return data as IapVerifyResult;
}

/** טיפול אחיד בכל רכישה שמגיעה מהחנות — גם כזו שחוזרת בפתיחת האפליקציה. */
async function handlePurchase(p: Purchase): Promise<void> {
  const key = `${p.productId}:${p.id}:${p.purchaseToken ?? ''}`;
  if (handledIds.has(key)) return;
  handledIds.add(key);
  const resolve = waiters.get(p.productId);
  try {
    if (p.purchaseState === 'pending') {
      resolve?.({ kind: 'pending' });
      waiters.delete(p.productId);
      handledIds.delete(key); // יגיע שוב כשיאושר
      return;
    }
    const res = await verifyOnServer(p);
    if (res.ok && res.status !== 'pending') {
      // רק אחרי שהשרת שמר — מסיימים מול החנות (אחרת Google מחזירה כסף אחרי 3 ימים)
      await finishTransaction({ purchase: p, isConsumable: false }).catch((e) =>
        logger.warn(TAG, 'finishTransaction failed', e),
      );
    } else {
      handledIds.delete(key); // ננסה שוב בפעם הבאה
    }
    if (!resolve) return;
    if (res.ok && res.entitled) {
      resolve({ kind: 'success', planId: res.planId ?? planForSku(p.productId) ?? '', expiresAt: res.expiresAt ?? null });
    } else if (res.ok && res.status === 'pending') {
      resolve({ kind: 'pending' });
    } else {
      resolve({
        kind: 'error',
        message:
          res.error === 'owned_by_other_account'
            ? 'הרכישה הזו כבר משויכת לחשבון DarkPool אחר.'
            : 'לא הצלחנו לאמת את הרכישה. אם חויבת — לחץ «שחזור רכישות» או פנה לתמיכה.',
      });
    }
  } catch (e) {
    handledIds.delete(key);
    logger.error(TAG, 'handlePurchase failed', e);
    resolve?.({ kind: 'error', message: 'לא הצלחנו לאמת את הרכישה. נסה שוב בעוד רגע.' });
  } finally {
    waiters.delete(p.productId);
  }
}

/**
 * מאזינים גלובליים — לקרוא פעם אחת אחרי שהמשתמש מחובר.
 * רכישות שלא הסתיימו (קריסה באמצע, Ask to Buy, תשלום מושהה) מטופלות כאן.
 */
export async function startIapListeners(): Promise<void> {
  if (!IAP_ENABLED || listenersStarted) return;
  if (!(await ensureConnection())) return;
  listenersStarted = true;
  purchaseUpdatedListener((p: Purchase) => {
    void handlePurchase(p);
  });
  purchaseErrorListener((err: PurchaseError) => {
    const sku = err.productId ?? '';
    const resolve = sku ? waiters.get(sku) : waiters.values().next().value;
    if (!resolve) return;
    waiters.clear();
    if (err.code === ErrorCode.UserCancelled) resolve({ kind: 'cancelled' });
    else resolve({ kind: 'error', message: 'הרכישה לא הושלמה. נסה שוב.' });
  });
  // רכישות שממתינות לסיום מהפעלה קודמת
  try {
    const pending = await getAvailablePurchases();
    for (const p of pending) void handlePurchase(p);
  } catch (e) {
    logger.warn(TAG, 'getAvailablePurchases on start failed', e);
  }
}

/** מחירים מהחנות (מטבע ומחיר מקומיים) — מה שמוצג למשתמש במובייל. */
export async function loadStorePrices(): Promise<Record<string, StorePrice>> {
  if (!(await ensureConnection())) return {};
  const out: Record<string, StorePrice> = {};
  try {
    const subs = await fetchProducts({ skus: Object.values(IAP_SUBSCRIPTION_SKUS), type: 'subs' });
    const oneTime = await fetchProducts({ skus: Object.values(IAP_ONE_TIME_SKUS), type: 'in-app' });
    for (const p of [...(subs ?? []), ...(oneTime ?? [])] as any[]) {
      const offer = Array.isArray(p.subscriptionOffers) ? p.subscriptionOffers[0] : null;
      const price: StorePrice = {
        sku: p.id,
        displayPrice: offer?.displayPrice && Platform.OS === 'android' ? offer.displayPrice : p.displayPrice,
        offerToken: offer?.offerTokenAndroid ?? null,
      };
      priceCache.set(p.id, price);
      const planId = planForSku(p.id);
      if (planId) out[planId] = price;
    }
  } catch (e) {
    logger.warn(TAG, 'fetchProducts failed', e);
  }
  return out;
}

/** רכישת מנוי / קורס. מחכה לאימות השרת לפני שמחזיר הצלחה. */
export async function purchasePlan(planId: string, userId: string): Promise<IapPurchaseOutcome> {
  const target = skuForPlan(planId);
  if (!target) return { kind: 'error', message: 'המסלול לא זמין לרכישה באפליקציה.' };
  if (!(await ensureConnection())) return { kind: 'error', message: 'החנות לא זמינה כרגע. נסה שוב.' };
  await startIapListeners();

  let price = priceCache.get(target.sku);
  if (!price) {
    await loadStorePrices();
    price = priceCache.get(target.sku);
  }
  if (!price) return { kind: 'error', message: 'המוצר לא נמצא בחנות. נסה שוב מאוחר יותר.' };

  const outcome = new Promise<IapPurchaseOutcome>((resolve) => waiters.set(target.sku, resolve));
  try {
    if (target.type === 'subs') {
      await requestPurchase({
        type: 'subs',
        request: {
          apple: { sku: target.sku, appAccountToken: userId },
          google: {
            skus: [target.sku],
            obfuscatedAccountId: userId,
            subscriptionOffers: price.offerToken ? [{ sku: target.sku, offerToken: price.offerToken }] : undefined,
          },
        },
      });
    } else {
      await requestPurchase({
        type: 'in-app',
        request: {
          apple: { sku: target.sku, appAccountToken: userId },
          google: { skus: [target.sku], obfuscatedAccountId: userId },
        },
      });
    }
  } catch (e: any) {
    waiters.delete(target.sku);
    if (e?.code === ErrorCode.UserCancelled) return { kind: 'cancelled' };
    logger.error(TAG, 'requestPurchase failed', e);
    return { kind: 'error', message: 'הרכישה לא הושלמה. נסה שוב.' };
  }
  return outcome;
}

/** «שחזור רכישות» — חובה לפי Apple. מחזיר כמה רכישות פעילות שויכו לחשבון. */
export async function restorePurchases(): Promise<{ restored: number; error?: string }> {
  if (!(await ensureConnection())) return { restored: 0, error: 'החנות לא זמינה כרגע.' };
  let restored = 0;
  let owned = false;
  try {
    const purchases = await getAvailablePurchases();
    for (const p of purchases) {
      const res = await verifyOnServer(p);
      if (res.ok && res.entitled) restored += 1;
      if (res.error === 'owned_by_other_account') owned = true;
      if (res.ok) await finishTransaction({ purchase: p, isConsumable: false }).catch(() => {});
    }
  } catch (e) {
    logger.error(TAG, 'restorePurchases failed', e);
    return { restored, error: 'השחזור נכשל. נסה שוב.' };
  }
  return { restored, error: owned && restored === 0 ? 'הרכישות שייכות לחשבון DarkPool אחר.' : undefined };
}

/** ניהול/ביטול מנוי — רק בחנות (אי אפשר לבטל מנוי של Apple/Google מתוך האפליקציה). */
export async function openStoreSubscriptionSettings(): Promise<void> {
  if (!(await ensureConnection())) return;
  await deepLinkToSubscriptions({}).catch((e: unknown) => logger.warn(TAG, 'deepLinkToSubscriptions failed', e));
}
