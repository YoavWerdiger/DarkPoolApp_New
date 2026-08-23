/**
 * CardCom shared helpers (edge only — never ship secrets to clients).
 *
 * OPERATION / RECURRING (Sprint 1 decision — keep renew working):
 * - Admin config stores only ChargeOnly | CreateTokenOnly (compliance Task 1).
 * - DarkPool subscriptions need charge + token for auto_renew via Token API.
 * - CardCom Operation "2" = ChargeAndCreateToken (legacy; still supported by API).
 * - resolveCreateOperation(isRecurring, configOperation):
 *     isRecurring === true  → always "2" (temporary compat until Task 7 deferred charge)
 *     isRecurring === false → configOperation (ChargeOnly default, or CreateTokenOnly)
 * - Webhook status after verified GetLpResult:
 *     ResponseCode ≠ 0            → failed
 *     ResponseCode = 0 + CreateTokenOnly → pending_charge (no subscription activation)
 *     ResponseCode = 0 + ChargeOnly|"2"|other charge ops → success + activate subscription
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';

export const CARDCOM_API_BASE = 'https://secure.cardcom.solutions/api/v11';
export const BUYER_PAYMENT_ERROR_EN =
  "we're sorry, a server error occurred please wait a bit and try again , if error persist please call us";
export const BUYER_PAYMENT_ERROR_HE =
  'מצטערים, אירעה שגיאת שרת. אנא המתינו מעט ונסו שוב. אם השגיאה נמשכת — פנו אלינו לתמיכה.';

export type CardComAdminOperation = 'ChargeOnly' | 'CreateTokenOnly';
/** Wire Operation sent to LowProfile/Create */
export type CardComWireOperation = CardComAdminOperation | '2';

export type CardComConfig = {
  apiName: string;
  apiPassword: string;
  terminalNumber: number;
  operation: CardComAdminOperation;
  source: 'db' | 'env';
};

export function resolveCreateOperation(
  isRecurring: boolean,
  configOperation: CardComAdminOperation,
): CardComWireOperation {
  // Temporary compat: recurring plans need Charge+Token until Task 7 (CreateTokenOnly + deferred Charge).
  if (isRecurring) return '2';
  return configOperation;
}

export function maskPassword(password: string | null | undefined): string {
  if (!password) return '';
  if (password.length <= 2) return '••';
  return `${'•'.repeat(Math.min(8, password.length - 2))}${password.slice(-2)}`;
}

export async function loadCardComConfig(supabase: SupabaseClient): Promise<CardComConfig | null> {
  const { data, error } = await supabase
    .from('cardcom_config')
    .select('api_name, api_password, terminal_number, operation')
    .eq('id', 1)
    .maybeSingle();

  if (!error && data?.api_name && data?.terminal_number) {
    const op = data.operation === 'CreateTokenOnly' ? 'CreateTokenOnly' : 'ChargeOnly';
    return {
      apiName: String(data.api_name),
      apiPassword: String(data.api_password ?? ''),
      terminalNumber: Number(data.terminal_number),
      operation: op,
      source: 'db',
    };
  }

  // Bootstrap fallback: Edge secrets (CARDCOM_* or legacy names)
  const apiName =
    Deno.env.get('CARDCOM_API_NAME') ||
    Deno.env.get('CardCom_ApiName') ||
    '';
  const apiPassword =
    Deno.env.get('CARDCOM_API_PASSWORD') ||
    Deno.env.get('CardCom_ApiPassword') ||
    '';
  const terminalRaw =
    Deno.env.get('CARDCOM_TERMINAL_NUMBER') ||
    Deno.env.get('CARDCOM_TERMINAL') ||
    Deno.env.get('CardCom_TerminalNumber') ||
    '';
  const opRaw =
    Deno.env.get('CARDCOM_OPERATION') ||
    Deno.env.get('CardCom_Operation') ||
    'ChargeOnly';
  const terminalNumber = Number(terminalRaw);
  if (!apiName || !terminalNumber) return null;

  return {
    apiName,
    apiPassword,
    terminalNumber,
    operation: opRaw === 'CreateTokenOnly' ? 'CreateTokenOnly' : 'ChargeOnly',
    source: 'env',
  };
}

export type GetLpResultResponse = {
  ResponseCode: number;
  Description?: string | null;
  TranzactionId?: number | null;
  Operation?: string | null;
  DocumentInfo?: {
    DocumentType?: string | null;
    DocumentNumber?: number | null;
    /** May be null — CardCom docs note DocumentUrl is sometimes unavailable from GetLpResult. */
    DocumentUrl?: string | null;
  } | null;
  TokenInfo?: {
    Token?: string | null;
    CardYear?: number | null;
    CardMonth?: number | null;
    TokenApprovalNumber?: string | null;
    CardOwnerIdentityNumber?: string | null;
    TokenExDate?: string | null;
    /** Some CardCom payloads put masked digits on TokenInfo as well as TranzactionInfo. */
    Last4CardDigitsString?: string | null;
    Last4CardDigits?: string | number | null;
    Brand?: string | null;
  } | null;
  TranzactionInfo?: {
    Last4CardDigitsString?: string | null;
    Last4CardDigits?: string | number | null;
    Brand?: string | null;
  } | null;
};

/** Normalize last4 + brand from GetLpResult for user_subscriptions display fields. */
export function extractCardDisplayFromLp(lp: GetLpResultResponse): {
  last4: string | null;
  brand: string | null;
} {
  const tranz = lp.TranzactionInfo || {};
  const token = lp.TokenInfo || {};
  const rawLast4 =
    tranz.Last4CardDigitsString ??
    tranz.Last4CardDigits ??
    token.Last4CardDigitsString ??
    token.Last4CardDigits ??
    null;
  let last4: string | null = null;
  if (rawLast4 != null && String(rawLast4).trim() !== '') {
    const digits = String(rawLast4).replace(/\D/g, '');
    if (digits.length >= 4) last4 = digits.slice(-4);
  }
  const brandRaw = tranz.Brand ?? token.Brand ?? null;
  const brand =
    brandRaw != null && String(brandRaw).trim() !== '' ? String(brandRaw).trim() : null;
  return { last4, brand };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** GetLpResult — timeout 5s, retry ×1 on HTTP/network error. Throws if both fail. */
export async function getLpResult(
  config: CardComConfig,
  lowProfileId: string,
): Promise<GetLpResultResponse> {
  const body = JSON.stringify({
    TerminalNumber: config.terminalNumber,
    ApiName: config.apiName,
    LowProfileId: lowProfileId,
  });
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body,
  };
  const url = `${CARDCOM_API_BASE}/LowProfile/GetLpResult`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, 5000);
      if (!res.ok) {
        lastError = new Error(`GetLpResult HTTP ${res.status}`);
        continue;
      }
      return (await res.json()) as GetLpResultResponse;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function mapVerifiedStatus(responseCode: number, operation: string | null | undefined): {
  status: 'success' | 'failed' | 'pending_charge';
  transactionIdToStore: string | null;
  activateSubscription: boolean;
} {
  if (responseCode !== 0) {
    return { status: 'failed', transactionIdToStore: null, activateSubscription: false };
  }
  const op = String(operation || '');
  if (op === 'CreateTokenOnly') {
    // Spec: pending charge, TranzactionId = 0
    return { status: 'pending_charge', transactionIdToStore: '0', activateSubscription: false };
  }
  // ChargeOnly, "2" (ChargeAndCreateToken), or unknown charge ops → paid
  return { status: 'success', transactionIdToStore: null, activateSubscription: true };
}

/** MMYY for CardExpiration — month=3 year=2026 → "0326"; year=26 → "0326" */
export function formatCardExpirationMMYY(month: number, year: number): string {
  const mm = String(Math.trunc(month)).padStart(2, '0');
  const y = Math.trunc(year);
  const yy = String(y > 99 ? y % 100 : y).padStart(2, '0');
  return `${mm}${yy}`;
}

export function isEmptyOrZeroTxnId(txnId: string | number | null | undefined): boolean {
  if (txnId == null) return true;
  const s = String(txnId).trim();
  return s.length === 0 || s === '0';
}

export type CancelDocResponse = {
  ResponseCode: number;
  Description?: string | null;
  NewDocumentNumber?: number | null;
  NewDocumentType?: string | null;
};

/** Documents/CancelDoc — full refund (server-side only; needs ApiPassword). */
export async function cancelDocument(
  config: CardComConfig,
  documentNumber: number,
  documentType: string,
): Promise<CancelDocResponse> {
  const res = await fetchWithTimeout(
    `${CARDCOM_API_BASE}/Documents/CancelDoc`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ApiName: config.apiName,
        ApiPassword: config.apiPassword,
        DocumentNumber: documentNumber,
        DocumentType: documentType,
      }),
    },
    15000,
  );
  if (!res.ok) throw new Error(`CancelDoc HTTP ${res.status}`);
  return (await res.json()) as CancelDocResponse;
}

export type TokenChargeRequest = {
  amount: number;
  token: string;
  cardExpirationMMYY: string;
  isoCoinId?: number;
  fullName: string;
  identityNumber?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  productDescription: string;
};

export type TokenChargeResponse = {
  ResponseCode: number;
  Description?: string | null;
  TranzactionId?: number | null;
  DocumentNumber?: number | null;
  DocumentType?: string | null;
  DocumentUrl?: string | null;
};

export type CreateDocumentUrlResponse = {
  ResponseCode: number;
  Description?: string | null;
  DocUrl?: string | null;
};

/** Documents/CreateDocumentUrl — needs ApiPassword; DocumentType must not be "Auto". */
export async function createDocumentUrl(
  config: CardComConfig,
  documentNumber: number,
  documentType: string,
): Promise<CreateDocumentUrlResponse> {
  const res = await fetchWithTimeout(
    `${CARDCOM_API_BASE}/Documents/CreateDocumentUrl`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ApiName: config.apiName,
        ApiPassword: config.apiPassword,
        DocumentNumber: documentNumber,
        DocumentType: documentType,
      }),
    },
    15000,
  );
  if (!res.ok) throw new Error(`CreateDocumentUrl HTTP ${res.status}`);
  return (await res.json()) as CreateDocumentUrlResponse;
}

/**
 * Prefer an explicit URL from the charge/GetLpResult response; otherwise call CreateDocumentUrl.
 * Returns null when CardCom cannot produce a link (missing number/type, Auto type, or API error).
 */
export async function resolveCardComDocumentUrl(
  config: CardComConfig,
  opts: {
    documentUrl?: string | null;
    documentNumber?: number | null;
    documentType?: string | null;
  },
): Promise<string | null> {
  const direct = typeof opts.documentUrl === 'string' ? opts.documentUrl.trim() : '';
  if (direct.startsWith('http')) return direct;

  const number = opts.documentNumber != null ? Number(opts.documentNumber) : NaN;
  const type = opts.documentType != null ? String(opts.documentType).trim() : '';
  if (!Number.isFinite(number) || number <= 0 || !type || type === 'Auto' || type === 'Error') {
    return null;
  }
  if (!config.apiPassword) return null;

  try {
    const result = await createDocumentUrl(config, number, type);
    if (Number(result.ResponseCode) === 0) {
      const url = typeof result.DocUrl === 'string' ? result.DocUrl.trim() : '';
      return url.startsWith('http') ? url : null;
    }
    console.warn(
      '[cardcom] CreateDocumentUrl non-zero',
      result.ResponseCode,
      result.Description,
    );
  } catch (err) {
    console.warn(
      '[cardcom] CreateDocumentUrl failed',
      err instanceof Error ? err.message : String(err),
    );
  }
  return null;
}

/** Transactions/Transaction — deferred charge with saved token. */
export async function chargeWithToken(
  config: CardComConfig,
  req: TokenChargeRequest,
): Promise<TokenChargeResponse> {
  const amount = Number(req.amount);
  const body = {
    TerminalNumber: config.terminalNumber,
    ApiName: config.apiName,
    Amount: amount,
    Token: req.token,
    CardExpirationMMYY: req.cardExpirationMMYY,
    NumOfPayments: 1,
    ISOCoinId: req.isoCoinId ?? 1,
    CardOwnerInformation: {
      FullName: req.fullName,
      IdentityNumber: req.identityNumber || undefined,
      CardOwnerEmail: req.email || undefined,
    },
    Document: {
      DocumentTypeToCreate: 'Auto',
      IsAllowEditDocument: true,
      IsSendByEmail: Boolean(req.email),
      Name: req.fullName,
      Email: req.email || undefined,
      AddressLine1: req.addressLine1 || undefined,
      AddressLine2: req.addressLine2 || undefined,
      City: req.city || undefined,
      Mobile: req.phone || undefined,
      Phone: req.phone || undefined,
      Language: 'he',
      Products: [
        {
          Description: req.productDescription,
          UnitCost: amount,
          Quantity: 1,
        },
      ],
    },
  };

  const res = await fetchWithTimeout(
    `${CARDCOM_API_BASE}/Transactions/Transaction`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    },
    20000,
  );
  if (!res.ok) throw new Error(`Transactions/Transaction HTTP ${res.status}`);
  return (await res.json()) as TokenChargeResponse;
}

/** Activate / replace user subscription after verified charged payment. */
export async function activateSubscriptionFromPayment(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    planId: string;
    sourceTransactionId: string;
    paymentToken?: string | null;
    tokenExpDate?: string | null;
    cardLast4?: string;
    cardBrand?: string;
  },
): Promise<{ ok: boolean; alreadyGranted?: boolean; error?: string }> {
  const {
    userId,
    planId,
    sourceTransactionId,
    paymentToken,
    tokenExpDate,
    cardLast4,
    cardBrand,
  } = opts;

  const { data: existing } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('source_transaction_id', sourceTransactionId)
    .maybeSingle();
  if (existing) return { ok: true, alreadyGranted: true };

  let period = 'monthly';
  let role = 'premium_user';
  const { data: planData } = await supabase
    .from('subscription_plans')
    .select('period, role')
    .eq('id', planId)
    .maybeSingle();
  if (planData?.period) period = String(planData.period);
  if (planData?.role) role = String(planData.role);

  const expiresAt = new Date();
  if (period === 'quarterly') expiresAt.setMonth(expiresAt.getMonth() + 3);
  else if (period === 'yearly') expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  else expiresAt.setMonth(expiresAt.getMonth() + 1);

  const now = new Date().toISOString();

  const { error: userErr } = await supabase
    .from('users')
    .update({
      subscription_plan: planId,
      subscription_role: role,
      subscription_expires_at: expiresAt.toISOString(),
      account_type: planId,
      updated_at: now,
    })
    .eq('id', userId);
  if (userErr) return { ok: false, error: userErr.message };

  const subscriptionData: Record<string, unknown> = {
    user_id: userId,
    plan_id: planId,
    status: 'active',
    starts_at: now,
    expires_at: expiresAt.toISOString(),
    auto_renew: true,
    source_transaction_id: sourceTransactionId,
    updated_at: now,
  };
  if (paymentToken) {
    subscriptionData.cardcom_token = paymentToken;
    if (tokenExpDate) subscriptionData.cardcom_token_exp_date = tokenExpDate;
  }
  // Card display fields are independent of token — ChargeOnly may return last4 without TokenInfo.
  const normalizedLast4 = cardLast4 ? String(cardLast4).replace(/\D/g, '').slice(-4) : '';
  if (normalizedLast4.length === 4) {
    subscriptionData.card_last4_digits = normalizedLast4;
  }
  if (cardBrand && String(cardBrand).trim()) {
    subscriptionData.card_brand = String(cardBrand).trim();
  }

  await supabase
    .from('user_subscriptions')
    .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
    .eq('user_id', userId)
    .eq('status', 'active');

  const { error: insErr } = await supabase.from('user_subscriptions').insert(subscriptionData);
  if (insErr) return { ok: false, error: insErr.message };
  return { ok: true };
}
