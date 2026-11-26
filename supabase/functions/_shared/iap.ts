// רכישות בתוך האפליקציה — אימות מול Apple / Google והענקת זכאות.
//
// עיקרון: הלקוח לא קובע כלום. כל מצב נשלף מחדש מה-API הרשמי של החנות (בשרת, ב-TLS),
// גם כשההתראה מגיעה מ-webhook — ולכן אין צורך לאמת חתימות JWS של ההתראות עצמן.
//
// Secrets (supabase secrets set ...):
//   APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID, APPLE_IAP_PRIVATE_KEY   — App Store Connect → Users and Access → Integrations → In-App Purchase
//   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON                               — service account עם הרשאת Financial data ב-Play Console
//   IAP_BUNDLE_ID (ברירת מחדל com.darkpool.app), IAP_ANDROID_PACKAGE (ברירת מחדל com.darkpool.app)

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';

export const BUNDLE_ID = Deno.env.get('IAP_BUNDLE_ID') ?? 'com.darkpool.app';
export const ANDROID_PACKAGE = Deno.env.get('IAP_ANDROID_PACKAGE') ?? 'com.darkpool.app';

export type IapKind = 'subscription' | 'one_time';
export type IapStatus = 'active' | 'expired' | 'revoked' | 'pending' | 'grace';

/** מזהי המוצרים בחנויות → המזהה שלנו. חייב להתאים ל-lib/iapProducts.ts בצד הלקוח. */
export const IAP_PRODUCTS: Record<string, { planId: string; kind: IapKind }> = {
  'com.darkpool.app.sub.monthly': { planId: 'monthly', kind: 'subscription' },
  'com.darkpool.app.sub.quarterly': { planId: 'quarterly', kind: 'subscription' },
  'com.darkpool.app.sub.yearly': { planId: 'yearly', kind: 'subscription' },
  'com.darkpool.app.course.whales': { planId: 'course:whales-course-1', kind: 'one_time' },
};

export type IapState = {
  platform: 'ios' | 'android';
  storeKey: string;
  productId: string;
  planId: string;
  kind: IapKind;
  status: IapStatus;
  expiresAt: string | null;
  autoRenew: boolean | null;
  transactionId: string | null;
  environment: string | null;
  /** המשתמש שהחנות קשרה לרכישה (appAccountToken / obfuscatedExternalAccountId) */
  boundUserId: string | null;
  raw: unknown;
};

// ---------------------------------------------------------------- crypto helpers

function b64url(bytes: Uint8Array | string): string {
  const bin = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

async function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  pem: string,
  alg: 'ES256' | 'RS256',
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(pem),
    alg === 'ES256' ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = await crypto.subtle.sign(
    alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : 'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(input),
  );
  return `${input}.${b64url(new Uint8Array(sig))}`;
}

/** מפענח את ה-payload של JWS שהתקבל ישירות מ-Apple ב-TLS (אמין בזכות המקור). */
export function decodeJwsPayload<T = Record<string, unknown>>(jws: string): T {
  const part = jws.split('.')[1] ?? '';
  const json = atob(part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(json, (c) => c.charCodeAt(0)))) as T;
}

// ---------------------------------------------------------------- Apple

async function appleToken(): Promise<string> {
  const keyId = Deno.env.get('APPLE_IAP_KEY_ID');
  const issuer = Deno.env.get('APPLE_IAP_ISSUER_ID');
  const pem = Deno.env.get('APPLE_IAP_PRIVATE_KEY');
  if (!keyId || !issuer || !pem) throw new Error('Apple IAP secrets missing');
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    { alg: 'ES256', kid: keyId, typ: 'JWT' },
    { iss: issuer, iat: now, exp: now + 1800, aud: 'appstoreconnect-v1', bid: BUNDLE_ID },
    pem,
    'ES256',
  );
}

const APPLE_HOSTS = ['https://api.storekit.itunes.apple.com', 'https://api.storekit-sandbox.itunes.apple.com'];

/** Production קודם; 404 → Sandbox (ההמלצה של Apple — כך גם TestFlight וגם App Review עובדים). */
async function appleGet(path: string): Promise<{ body: any; environment: string }> {
  const token = await appleToken();
  let lastStatus = 0;
  for (const host of APPLE_HOSTS) {
    const res = await fetch(`${host}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) return { body: await res.json(), environment: host.includes('sandbox') ? 'Sandbox' : 'Production' };
    lastStatus = res.status;
    if (res.status !== 404) break;
  }
  throw new Error(`Apple API ${path} → HTTP ${lastStatus}`);
}

type AppleTx = {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  bundleId: string;
  expiresDate?: number;
  revocationDate?: number;
  appAccountToken?: string;
  environment?: string;
};

/** מצב עדכני של רכישה ב-iOS לפי transactionId (כל transaction מאותה שרשרת מנוי). */
export async function fetchAppleState(transactionId: string): Promise<IapState> {
  const { body } = await appleGet(`/inApps/v1/transactions/${encodeURIComponent(transactionId)}`);
  const tx = decodeJwsPayload<AppleTx>(body.signedTransactionInfo);
  if (tx.bundleId !== BUNDLE_ID) throw new Error('bundle mismatch');
  const product = IAP_PRODUCTS[tx.productId];
  if (!product) throw new Error(`unknown product ${tx.productId}`);

  if (product.kind === 'one_time') {
    return {
      platform: 'ios',
      storeKey: tx.originalTransactionId,
      productId: tx.productId,
      planId: product.planId,
      kind: 'one_time',
      status: tx.revocationDate ? 'revoked' : 'active',
      expiresAt: null,
      autoRenew: null,
      transactionId: tx.transactionId,
      environment: tx.environment ?? null,
      boundUserId: tx.appAccountToken ?? null,
      raw: tx,
    };
  }

  // מנוי: שולפים את המצב העדכני של כל השרשרת (חידושים, grace, ביטול)
  const { body: subs } = await appleGet(`/inApps/v1/subscriptions/${encodeURIComponent(tx.originalTransactionId)}`);
  let latest: AppleTx = tx;
  let statusCode = 0;
  let autoRenew: boolean | null = null;
  for (const group of subs.data ?? []) {
    for (const item of group.lastTransactions ?? []) {
      if (String(item.originalTransactionId) !== String(tx.originalTransactionId)) continue;
      statusCode = Number(item.status);
      latest = decodeJwsPayload<AppleTx>(item.signedTransactionInfo);
      if (item.signedRenewalInfo) {
        const renewal = decodeJwsPayload<{ autoRenewStatus?: number }>(item.signedRenewalInfo);
        autoRenew = renewal.autoRenewStatus === 1;
      }
    }
  }
  const latestProduct = IAP_PRODUCTS[latest.productId] ?? product;
  // 1 active, 2 expired, 3 billing retry, 4 grace period, 5 revoked
  const status: IapStatus =
    statusCode === 1 ? 'active' : statusCode === 4 ? 'grace' : statusCode === 5 || latest.revocationDate ? 'revoked' : 'expired';
  return {
    platform: 'ios',
    storeKey: tx.originalTransactionId,
    productId: latest.productId,
    planId: latestProduct.planId,
    kind: 'subscription',
    status,
    expiresAt: latest.expiresDate ? new Date(latest.expiresDate).toISOString() : null,
    autoRenew,
    transactionId: latest.transactionId,
    environment: latest.environment ?? null,
    boundUserId: latest.appAccountToken ?? tx.appAccountToken ?? null,
    raw: latest,
  };
}

// ---------------------------------------------------------------- Google

let googleTokenCache: { token: string; exp: number } | null = null;

async function googleToken(): Promise<string> {
  if (googleTokenCache && googleTokenCache.exp > Date.now() + 60_000) return googleTokenCache.token;
  const raw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new Error('Google Play service account missing');
  const sa = JSON.parse(raw) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    'RS256',
  );
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`Google OAuth HTTP ${res.status}`);
  const json = await res.json();
  googleTokenCache = { token: json.access_token, exp: Date.now() + Number(json.expires_in ?? 3600) * 1000 };
  return googleTokenCache.token;
}

const GP = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${ANDROID_PACKAGE}/purchases`;

async function googleCall(url: string, method: 'GET' | 'POST' = 'GET'): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${await googleToken()}`, 'Content-Type': 'application/json' },
    body: method === 'POST' ? '{}' : undefined,
  });
  if (!res.ok) throw new Error(`Google Play API HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

/** מצב עדכני של רכישה באנדרואיד. productId נדרש רק לרכישה חד-פעמית. */
export async function fetchGoogleState(purchaseToken: string, productId: string): Promise<IapState> {
  const product = IAP_PRODUCTS[productId];
  if (!product) throw new Error(`unknown product ${productId}`);

  if (product.kind === 'one_time') {
    const p = await googleCall(`${GP}/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`);
    // purchaseState: 0 purchased, 1 canceled (refund/void), 2 pending
    const status: IapStatus = p.purchaseState === 0 ? 'active' : p.purchaseState === 2 ? 'pending' : 'revoked';
    if (status === 'active' && p.acknowledgementState !== 1) {
      await googleCall(`${GP}/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, 'POST');
    }
    return {
      platform: 'android',
      storeKey: purchaseToken,
      productId,
      planId: product.planId,
      kind: 'one_time',
      status,
      expiresAt: null,
      autoRenew: null,
      transactionId: p.orderId ?? null,
      environment: p.purchaseType === 0 ? 'Sandbox' : 'Production',
      boundUserId: p.obfuscatedExternalAccountId ?? null,
      raw: p,
    };
  }

  const s = await googleCall(`${GP}/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`);
  const line = (s.lineItems ?? [])[0] ?? {};
  const lineProduct = IAP_PRODUCTS[line.productId] ?? product;
  const state = String(s.subscriptionState ?? '');
  const status: IapStatus =
    state === 'SUBSCRIPTION_STATE_ACTIVE' || state === 'SUBSCRIPTION_STATE_CANCELED' // CANCELED = לא יתחדש, עדיין בתוקף עד expiry
      ? 'active'
      : state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
        ? 'grace'
        : state === 'SUBSCRIPTION_STATE_PENDING'
          ? 'pending'
          : 'expired'; // ON_HOLD / PAUSED / EXPIRED
  if ((status === 'active' || status === 'grace') && s.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
    await googleCall(
      `${GP}/subscriptions/${encodeURIComponent(line.productId ?? productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
      'POST',
    );
  }
  return {
    platform: 'android',
    storeKey: purchaseToken,
    productId: line.productId ?? productId,
    planId: lineProduct.planId,
    kind: 'subscription',
    status,
    expiresAt: line.expiryTime ?? null,
    autoRenew: line.autoRenewingPlan?.autoRenewEnabled ?? null,
    transactionId: s.latestOrderId ?? null,
    environment: s.testPurchase ? 'Sandbox' : 'Production',
    boundUserId: s.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    raw: { ...s, linkedPurchaseToken: s.linkedPurchaseToken ?? null },
  };
}

// ---------------------------------------------------------------- entitlement

/**
 * שומר את המצב ומעניק/מבטל זכאות. userId — מי שמבקש (iap-verify) או הבעלים הרשום (webhooks).
 * מחזיר שגיאה אם הרכישה כבר שייכת למשתמש אחר.
 */
export async function applyIapState(
  supabase: SupabaseClient,
  state: IapState,
  userId: string,
): Promise<{ ok: boolean; error?: string; entitled: boolean }> {
  const { data: existing } = await supabase
    .from('iap_purchases')
    .select('user_id')
    .eq('platform', state.platform)
    .eq('store_key', state.storeKey)
    .maybeSingle();
  if (existing && existing.user_id !== userId) {
    return { ok: false, error: 'owned_by_other_account', entitled: false };
  }
  if (state.boundUserId && state.boundUserId !== userId) {
    return { ok: false, error: 'owned_by_other_account', entitled: false };
  }

  const now = new Date().toISOString();
  const { error: upErr } = await supabase.from('iap_purchases').upsert(
    {
      user_id: userId,
      platform: state.platform,
      store_key: state.storeKey,
      product_id: state.productId,
      plan_id: state.planId,
      kind: state.kind,
      status: state.status,
      last_transaction_id: state.transactionId,
      expires_at: state.expiresAt,
      auto_renew: state.autoRenew,
      environment: state.environment,
      raw: state.raw as Record<string, unknown>,
      updated_at: now,
    },
    { onConflict: 'platform,store_key' },
  );
  if (upErr) return { ok: false, error: upErr.message, entitled: false };

  // Google: שדרוג/שנמוך מחליף token — הישן לא בתוקף יותר
  const linked = (state.raw as { linkedPurchaseToken?: string | null })?.linkedPurchaseToken;
  if (state.platform === 'android' && linked) {
    await supabase
      .from('iap_purchases')
      .update({ status: 'expired', updated_at: now })
      .eq('platform', 'android')
      .eq('store_key', linked);
    await supabase
      .from('user_subscriptions')
      .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
      .eq('source_transaction_id', `iap:android:${linked}`)
      .eq('status', 'active');
  }

  const entitled = state.status === 'active' || state.status === 'grace';

  if (state.kind === 'one_time') {
    const courseId = state.planId.startsWith('course:') ? state.planId.slice('course:'.length) : null;
    if (!courseId) return { ok: true, entitled };
    if (entitled) {
      const { error } = await supabase.from('course_purchases').upsert(
        { user_id: userId, course_id: courseId, transaction_id: null, amount: null, granted_at: now },
        { onConflict: 'user_id,course_id', ignoreDuplicates: true },
      );
      if (error) return { ok: false, error: error.message, entitled: false };
    } else if (state.status === 'revoked') {
      await supabase.from('course_purchases').delete().eq('user_id', userId).eq('course_id', courseId);
    }
    return { ok: true, entitled };
  }

  // מנוי
  const source = `iap:${state.platform}:${state.storeKey}`;
  const { data: subRow } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('source_transaction_id', source)
    .maybeSingle();

  if (entitled && state.expiresAt) {
    const { data: planData } = await supabase
      .from('subscription_plans')
      .select('role')
      .eq('id', state.planId)
      .maybeSingle();
    const role = planData?.role ? String(planData.role) : 'premium_user';

    if (subRow) {
      await supabase
        .from('user_subscriptions')
        .update({
          plan_id: state.planId,
          status: 'active',
          expires_at: state.expiresAt,
          auto_renew: state.autoRenew ?? true,
          cancelled_at: null,
          updated_at: now,
        })
        .eq('id', subRow.id);
    } else {
      await supabase
        .from('user_subscriptions')
        .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
        .eq('user_id', userId)
        .eq('status', 'active');
      const { error } = await supabase.from('user_subscriptions').insert({
        user_id: userId,
        plan_id: state.planId,
        status: 'active',
        starts_at: now,
        expires_at: state.expiresAt,
        auto_renew: state.autoRenew ?? true,
        source_transaction_id: source,
        updated_at: now,
      });
      if (error) return { ok: false, error: error.message, entitled: false };
    }

    const { error: userErr } = await supabase
      .from('users')
      .update({
        subscription_plan: state.planId,
        subscription_role: role,
        subscription_expires_at: state.expiresAt,
        account_type: state.planId,
        updated_at: now,
      })
      .eq('id', userId)
      .or('subscription_role.is.null,subscription_role.not.in.(admin,super_admin)');
    if (userErr) return { ok: false, error: userErr.message, entitled: false };
    return { ok: true, entitled: true };
  }

  // לא בתוקף (פג / בוטל / הוחזר)
  if (subRow) {
    await supabase
      .from('user_subscriptions')
      .update({
        status: state.status === 'revoked' ? 'cancelled' : 'expired',
        cancelled_at: state.status === 'revoked' ? now : null,
        expires_at: state.status === 'revoked' ? now : state.expiresAt,
        auto_renew: false,
        updated_at: now,
      })
      .eq('id', subRow.id);
  }
  const { data: stillActive } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', now)
    .limit(1);
  if (!stillActive || stillActive.length === 0) {
    await supabase
      .from('users')
      .update({
        subscription_plan: 'free',
        subscription_role: 'free_user',
        account_type: 'free',
        subscription_expires_at: null,
        updated_at: now,
      })
      .eq('id', userId)
      .or('subscription_role.is.null,subscription_role.not.in.(admin,super_admin)');
  }
  return { ok: true, entitled: false };
}

/** בעלים רשום של רכישה (ל-webhooks): קודם הטבלה, אחר כך המזהה שנקשר בחנות. */
export async function resolveOwner(supabase: SupabaseClient, state: IapState): Promise<string | null> {
  const { data } = await supabase
    .from('iap_purchases')
    .select('user_id')
    .eq('platform', state.platform)
    .eq('store_key', state.storeKey)
    .maybeSingle();
  if (data?.user_id) return data.user_id as string;
  const linked = (state.raw as { linkedPurchaseToken?: string | null })?.linkedPurchaseToken;
  if (linked) {
    const { data: prev } = await supabase
      .from('iap_purchases')
      .select('user_id')
      .eq('platform', 'android')
      .eq('store_key', linked)
      .maybeSingle();
    if (prev?.user_id) return prev.user_id as string;
  }
  return state.boundUserId;
}
