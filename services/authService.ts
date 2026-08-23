import type { AuthChangeEvent, User as SupabaseAuthUser } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { openAuthSessionAsync, WebBrowserAuthSessionResult } from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { logger } from '../utils/logger';
import { SUPABASE_URL } from '../config/publicEnv';
import { mediaService } from './mediaService';

/**
 * כותב את שורת ה-public.users של המשתמש עצמו: UPDATE, ואם לא נגעה בשורה —
 * INSERT. מחליף `.upsert()`: PostgREST מתרגם upsert ל-
 * `INSERT ... ON CONFLICT DO UPDATE`, ו-Postgres דורש הרשאת SELECT על *כל*
 * עמודה שנכתבת ככה. `authenticated` איבד SELECT על email/phone וכו' כדי
 * שמשתמשים לא יקראו זה את הפרטים של זה, ולכן upsert מחזיר 42501.
 * UPDATE רגיל דורש SELECT רק על עמודות ה-WHERE, ו-`select('id')` מחזיר רק
 * עמודה ציבורית — כך אפשר לדעת אם השורה קיימת בלי לקרוא שום דבר פרטי.
 *
 * `insertOnly` הן עמודות שמותר לכתוב רק ב-INSERT (כרגע `email`, שהיא NOT NULL
 * בלי default אבל לא ניתנת לעדכון מהקליינט). Postgres בודק הרשאת עמודה לפי
 * רשימת ה-SET, לא לפי הערך — לכן שליחת `email` ב-UPDATE נכשלת ב-42501 גם
 * כשהערך זהה, וחייבים להשאיר אותה מחוץ ל-payload של ה-UPDATE.
 */
async function upsertOwnUserRow(
  userId: string,
  payload: Record<string, unknown>,
  insertOnly: Record<string, unknown> = {},
): Promise<{ error: { message: string } | null }> {
  const { id: _ignored, ...columns } = payload;

  const { data: updated, error: updateError } = await supabase
    .from('users')
    .update(columns)
    .eq('id', userId)
    .select('id');

  if (updateError) return { error: updateError };
  if ((updated?.length ?? 0) > 0) return { error: null };

  // הטריגר on_auth_user_created בדרך כלל כבר יצר את השורה; אם לא — יוצרים אותה.
  const { error: insertError } = await supabase
    .from('users')
    .insert({ id: userId, ...insertOnly, ...columns });

  return { error: insertError };
}

/** מפתח אחסון הסשן של GoTrue ב-AsyncStorage (sb-<project-ref>-auth-token) */
function supabaseAuthStorageKey(): string {
  try {
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return 'sb-wpmrtczbfcijoocguime-auth-token';
  }
}

/** ניקוי כפוי של סשן Supabase מ-AsyncStorage כש-signOut נכשל ברשת */
async function clearPersistedAuthStorage(): Promise<void> {
  const primary = supabaseAuthStorageKey();
  const known = [primary, `${primary}-code-verifier`, `${primary}-user`];
  try {
    const all = await AsyncStorage.getAllKeys();
    const extras = all.filter(
      (k) =>
        k.startsWith('sb-') &&
        (k.includes('auth-token') || k.endsWith('-code-verifier') || k.endsWith('-user'))
    );
    const toRemove = Array.from(new Set([...known, ...extras]));
    if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
  } catch (error) {
    logger.warn('AuthService', 'clearPersistedAuthStorage failed', error);
  }
}

/** חייב להתאים לפורמת scheme://host של Supabase; ב-Android expo-web-browser משווה startsWith ל-returnUrl */
const GOOGLE_OAUTH_REDIRECT_NATIVE = 'com.darkpool.app://oauth';

/** מונע שני signInWithOAuth במקביל — מחליף code-verifier ב-AsyncStorage ושובר PKCE */
let googleOAuthFlowLock = false;

/** GoTrue מצפה ל-auth_code בלבד, לא ל-URL מלא (אחרת 422 / invalid flow state בפרודקשן) */
function extractPkceCodeFromCallbackUrl(callbackUrl: string): string | null {
  try {
    const parsed = Linking.parse(callbackUrl);
    const q = parsed.queryParams as Record<string, string | undefined> | null;
    const fromExpo = q?.code;
    if (typeof fromExpo === 'string' && fromExpo.length > 0) return fromExpo;
    const u = new URL(callbackUrl);
    return u.searchParams.get('code');
  } catch {
    return null;
  }
}

export const PHONE_TAKEN_HE = 'מספר הטלפון כבר בשימוש אצל משתמש אחר';

/**
 * trim + ספרות בלבד (כמו בהרשמה); ריק / רווחים → null
 * (UNIQUE מאפשר כמה NULL, לא כמה '')
 */
export function normalizeProfilePhone(phone: string | null | undefined): string | null {
  if (phone == null) return null;
  const digits = String(phone).replace(/[^\d]/g, '');
  return digits === '' ? null : digits;
}

/**
 * נרמול ל-E.164 ישראלי עבור Supabase Phone Auth / Twilio.
 * מקבל 054… / 54… / 97254… / +97254… ומחזיר +9725… או null אם לא תקין.
 */
export function toE164IsraeliPhone(phone: string | null | undefined): string | null {
  if (phone == null) return null;
  const raw = String(phone).trim();
  if (!raw) return null;

  let digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('972')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // נייד ישראלי אחרי הסרת קידומת: 9 ספרות שמתחילות ב-5
  if (!/^5\d{8}$/.test(digits)) return null;
  return `+972${digits}`;
}

function collectErrorText(err: unknown): { message: string; code: string | null; blob: string } {
  if (err == null) return { message: '', code: null, blob: '' };
  if (typeof err === 'string') {
    return { message: err, code: null, blob: err };
  }
  const e = err as {
    message?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const message = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' || typeof e.code === 'number' ? String(e.code) : null;
  const details = typeof e.details === 'string' ? e.details : '';
  const hint = typeof e.hint === 'string' ? e.hint : '';
  const blob = [message, details, hint, code || ''].filter(Boolean).join(' ');
  return { message, code, blob };
}

function isPhoneUniqueViolation(blob: string, code: string | null): boolean {
  const t = blob.toLowerCase();
  if (t.includes('users_phone_key')) return true;
  if (t.includes('key (phone)') || t.includes('key(phone)')) return true;
  const looksUnique = code === '23505' || t.includes('duplicate') || t.includes('unique');
  return looksUnique && t.includes('phone');
}

/** הודעות שגיאה בעברית לעדכון פרופיל — גם מ־AuthContext / UI */
export function mapProfileUpdateError(err?: unknown, codeHint?: string | null): string {
  const { message, code, blob } = collectErrorText(err);
  const resolvedCode = codeHint || code;
  if (!blob && !resolvedCode) return 'שגיאה בעדכון הפרופיל. נסה שוב.';

  if (isPhoneUniqueViolation(blob, resolvedCode)) {
    return PHONE_TAKEN_HE;
  }

  const msg = blob.toLowerCase();
  if (msg.includes('schema cache') || msg.includes('could not find')) {
    return 'שגיאת סנכרון מול השרת. נסה שוב בעוד רגע.';
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
    return 'בעיית רשת. בדוק חיבור ונסה שוב.';
  }
  if (msg.includes('permission') || msg.includes('policy') || msg.includes('rls') || msg.includes('not allowed')) {
    return 'אין הרשאה לעדכן את הפרופיל.';
  }
  if (resolvedCode === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
    return 'הערך כבר קיים במערכת.';
  }
  // אל תציג הודעות טכניות באנגלית למשתמש
  if (/[a-z]{4,}/i.test(message || blob) && !/[\u0590-\u05FF]/.test(message || blob)) {
    return 'לא הצלחנו לשמור את הפרופיל. נסה שוב.';
  }
  if (/[\u0590-\u05FF]/.test(message)) return message;
  return 'שגיאה בעדכון הפרופיל. נסה שוב.';
}

/** כשהפרופיל מ־public.users לא זמין בזמן (רשת איטית וכו') — לא מנתקים סשן תקף */
function authUserToAppUser(u: SupabaseAuthUser): AuthUser {
  const meta = (u.user_metadata || {}) as Record<string, unknown>;
  const email = u.email ?? '';
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.display_name === 'string' && meta.display_name) ||
    email.split('@')[0] ||
    '';
  
  const display_name_value = (typeof meta.display_name === 'string' && meta.display_name) || name || undefined;
  const full_name_value = (typeof meta.full_name === 'string' && meta.full_name) || name || undefined;
  
  return {
    id: u.id,
    email,
    display_name: display_name_value,
    displayName: display_name_value || full_name_value, // Alias: prefer display_name, fallback to full_name
    full_name: full_name_value,
    profile_picture:
      typeof meta.avatar_url === 'string'
        ? meta.avatar_url
        : typeof meta.profile_picture === 'string'
          ? meta.profile_picture
          : undefined,
    created_at: u.created_at,
    // ללא פרופיל מ-DB — לא מניחים שהרישום הושלם (מונע קפיצה ל-Main אחרי OTP באמצע אשף)
    registration_completed: false,
  };
}

export interface AuthUser {
  id: string;
  email: string;
  display_name?: string;
  displayName?: string; // Alias for display_name or full_name
  full_name?: string;
  phone?: string;
  gender?: 'male' | 'female';
  profile_picture?: string;
  account_type?: string;
  track_id?: string;
  intro_data?: any;
  registration_completed?: boolean;
  /** ISO timestamp — מועד יצירת החשבון */
  created_at?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  display_name: string;
  profile_picture?: string;
  account_type?: string;
  full_name?: string;
  phone?: string;
  track_id?: string;
  intro_data?: any;
  /** false = חשבון נוצר באמצע רישום (לפני תשלום/סיכום); ברירת מחדל true */
  registration_completed?: boolean;
}

/**
 * רישום הושלם רק כשהדגל במפורש true.
 * false / undefined (fallback בלי פרופיל אחרי OTP) → נשארים ב-Onboarding.
 */
export function isRegistrationComplete(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return user.registration_completed === true;
}

/** האם יש ראיות בפרופיל שהמשתמש כבר סיים onboarding (גם אם הדגל נשאר false בטעות) */
function hasCompletedRegistrationEvidence(user: AuthUser): boolean {
  const intro = user.intro_data;
  if (intro && typeof intro === 'object') {
    const keys = Object.keys(intro as object);
    if (keys.length === 0) return false;
    const record = intro as Record<string, unknown>;
    // שאלון חדש או ישן
    if (
      record.age_range ||
      record.experience_level ||
      record.trading_focus ||
      record.experience ||
      record.markets ||
      record.level ||
      record.goal
    ) {
      return true;
    }
  }
  return false;
}

export interface RegistrationData {
  full_name: string;
  phone: string;
  track_id: string;
  intro_data: {
    age?: number;
    age_range?: string;
    experience_level?: string;
    trading_focus?: string;
    /** Multi-select; legacy clients may still send a single string */
    trading_platform?: string[] | string;
    portfolio_size?: string;
    // legacy keys still accepted from older clients / tests
    markets?: string[];
    experience?: string;
    styles?: string[];
    brokers?: string[];
    level?: string;
    goal?: string;
    communityGoals?: string[];
    hours?: string;
    socials?: string[];
    heardFrom?: string;
    wish?: string;
  };
}

export class AuthService {
  // Sign in with email and password
  static async signIn({ email, password }: LoginCredentials): Promise<{ user: AuthUser | null; error: string | null }> {
    const maxRetries = 3;
    let lastError: any = null;
    const normalizedEmail = email.trim().toLowerCase();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // בדיקה בסיסית של חיבור לאינטרנט לפני הבקשה
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // timeout של 5 שניות
          
          const testResponse = await fetch(SUPABASE_URL, { 
            method: 'HEAD',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
        } catch (networkError: any) {
          if (attempt === maxRetries) {
            return { 
              user: null, 
              error: 'בעיית חיבור לאינטרנט. אנא בדוק:\n1. שהאמולטור/מכשיר מחובר לאינטרנט\n2. שהרשת מאפשרת גישה לאתרים חיצוניים\n3. נסה להפעיל מחדש את האפליקציה' 
            };
          }
          // נמתין קצת לפני ניסיון נוסף
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        
        if (error) {
          lastError = error;
          
          // טיפול מיוחד בשגיאות רשת
          if (error.message?.includes('Network request failed') || 
              error.message?.includes('fetch') || 
              error.status === 0 ||
              error.status === null) {
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              continue;
            }
            return { 
              user: null, 
              error: 'בעיית חיבור לאינטרנט. אנא בדוק:\n1. שהאמולטור/מכשיר מחובר לאינטרנט\n2. שהרשת מאפשרת גישה לאתרים חיצוניים\n3. נסה להפעיל מחדש את האפליקציה' 
            };
          }

          const raw = (error.message || '').toLowerCase();
          if (
            raw.includes('invalid login credentials') ||
            raw.includes('invalid_credentials')
          ) {
            return { user: null, error: 'אימייל או סיסמה שגויים' };
          }
          if (raw.includes('email not confirmed')) {
            return { user: null, error: 'יש לאמת את כתובת האימייל לפני ההתחברות' };
          }
          if (raw.includes('too many requests') || error.status === 429) {
            return { user: null, error: 'יותר מדי ניסיונות. נסה שוב בעוד כמה דקות' };
          }
          
          // שגיאות אחרות לא דורשות retry
          return { user: null, error: error.message || 'שגיאה בהתחברות' };
        }
        
        if (!data.user) {
          return { user: null, error: 'שגיאה בהתחברות - אין נתוני משתמש' };
        }
        
        const user = await this.getUserProfile(data.user.id);
        if (!user) {
          return { user: null, error: 'שגיאה בטעינת פרופיל המשתמש' };
        }

        return { user: await this.healRegistrationCompletedIfNeeded(user), error: null };
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || String(error);
        
        if ((errorMessage.includes('Network request failed') || 
             errorMessage.includes('fetch') ||
             errorMessage.includes('AbortError')) && 
            attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        if (attempt === maxRetries) {
          if (errorMessage.includes('Network request failed') || errorMessage.includes('fetch')) {
            return { 
              user: null, 
              error: 'בעיית חיבור לאינטרנט. אנא בדוק:\n1. שהאמולטור/מכשיר מחובר לאינטרנט\n2. שהרשת מאפשרת גישה לאתרים חיצוניים\n3. נסה להפעיל מחדש את האפליקציה' 
            };
          }
          return { user: null, error: errorMessage };
        }
      }
    }

    // אם הגענו לכאן, כל הניסיונות נכשלו
    return { 
      user: null, 
      error: lastError?.message || 'שגיאה בהתחברות לאחר מספר ניסיונות' 
    };
  }

  // Sign up with email and password
  static async signUp({ 
    email, 
    password, 
    display_name, 
    profile_picture, 
    account_type,
    full_name,
    phone,
    track_id,
    intro_data,
    registration_completed = true,
  }: RegisterCredentials): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      // בדיקה אם המייל כבר קיים
      const { exists, error: checkError } = await this.checkEmailExists(email);
      if (!checkError && exists) {
        return { user: null, error: 'כתובת המייל כבר קיימת במערכת' };
      }

      // ניסיון ראשון: הרשמה רגילה
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            display_name, 
            profile_picture, 
            account_type,
            full_name: full_name || display_name
          }
        }
      });

      // טיפול בשגיאה שכיחה: המייל כבר רשום ב-auth.users
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (
          msg.includes('already registered') ||
          msg.includes('already exists') ||
          msg.includes('user already') ||
          (error as any)?.code === 'user_already_exists'
        ) {
          return {
            user: null,
            error: 'כתובת המייל כבר רשומה — יש להתחבר או לאפס סיסמה',
          };
        }
        return { user: null, error: error.message || 'שגיאה בהרשמה' };
      }

      if (!data.user) {
        return { user: null, error: 'שגיאה בהרשמה - לא התקבלו נתוני משתמש' };
      }

      // הטריגר on_auth_user_created יצר כבר שורה ב-public.users עם (id, email, full_name, display_name).
      // לכן חייבים UPSERT על id — insert רגיל היה נכשל עם duplicate key על users_pkey.
      // account_type / subscription_* אינם נכתבים מהקליינט — הם קובעים הרשאה
      // ולכן מוגנים בהרשאות-עמודה. ברירת המחדל בטבלה כבר 'free'/'free_user',
      // והשדרוג לתשלום מגיע מה-webhook של Cardcom (rapid-responder).
      const planId = account_type || 'free';
      const userData: any = {
        id: data.user.id,
        display_name: display_name,
        full_name: full_name || display_name,
        profile_picture: profile_picture || null,
        track_id: track_id || '1', // default למסלול מתחילים
        intro_data: intro_data || {},
        registration_completed: registration_completed !== false,
      };

      // הוספת טלפון רק אם הוא קיים ובפורמט נכון
      if (phone && phone.trim()) {
        const cleanPhone = phone.replace(/[^\d]/g, '');
        if (cleanPhone.length >= 10 && cleanPhone.length <= 15) {
          userData.phone = cleanPhone;
        }
      }

      const { error: upsertError } = await upsertOwnUserRow(data.user.id, userData, {
        email: data.user.email,
      });

      if (upsertError) {
        return { user: null, error: `Database error: ${upsertError.message}` };
      }

      // רשומת מנוי חינמי פעילה — useSubscription קורא מ-user_subscriptions
      if (planId === 'free' && registration_completed !== false) {
        await this.ensureFreeSubscriptionRow(data.user.id);
      }

      const finalUser = await this.getUserProfile(data.user.id);
      return { user: finalUser, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  }

  /**
   * יוצר/מחזיר userId לפני תשלום Cardcom בזרימת רישום.
   * חובה שה-webhook יקבל userId אמיתי כדי להפעיל user_subscriptions.
   */
  static async ensurePendingAuthUser(params: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    profileImage?: string | null;
    accountType: string;
    trackId?: string;
    existingUserId?: string | null;
    /** Optional — questionnaire already answered before payment; Summary also upserts */
    intro_data?: Record<string, unknown>;
  }): Promise<{ userId: string | null; error: string | null }> {
    if (params.existingUserId) {
      return { userId: params.existingUserId, error: null };
    }

    const remoteProfile = await mediaService.ensureRemoteMediaUrl(params.profileImage, 'image');
    if (params.profileImage && remoteProfile.error) {
      return { userId: null, error: remoteProfile.error || 'העלאת תמונת הפרופיל נכשלה' };
    }

    const result = await this.signUp({
      email: params.email,
      password: params.password,
      display_name: params.fullName,
      full_name: params.fullName,
      profile_picture: remoteProfile.url ?? undefined,
      phone: params.phone,
      track_id: params.trackId || '1',
      account_type: params.accountType || 'monthly',
      registration_completed: false,
      intro_data: params.intro_data || {},
    });

    if (result.error || !result.user) {
      return { userId: null, error: result.error || 'שגיאה ביצירת חשבון לפני תשלום' };
    }
    return { userId: result.user.id, error: null };
  }

  /**
   * רשומת free פעילה ב-user_subscriptions (idempotent).
   * `user_subscriptions` אינה ניתנת לכתיבה מהקליינט — רשומה שם היא-היא ההרשאה
   * ש-useSubscription קורא, ולכן משתמש שיכול לכתוב אליה יכול להעניק לעצמו
   * פרימיום. ה-RPC רץ SECURITY DEFINER על auth.uid() ואינו מקבל plan כפרמטר,
   * כך שאי אפשר להטות אותו למסלול בתשלום.
   */
  static async ensureFreeSubscriptionRow(_userId?: string): Promise<void> {
    try {
      await supabase.rpc('ensure_free_subscription');
    } catch {
      // לא חוסם הרשמה — webhook/סיכום יכולים לתקן בהמשך
    }
  }

  // Resend signup verification email (קישור Confirm — זרימות ישנות / Legacy Register)
  static async resendVerificationEmail(email: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (error) {
        return { error: error.message || 'שגיאה בשליחת מייל האימות' };
      }
      return { error: null };
    } catch (error: any) {
      return { error: error?.message || 'שגיאה בשליחת מייל האימות' };
    }
  }

  /**
   * שליחת OTP לאימייל באמצע אשף הרישום (מיד אחרי שלב המייל).
   * דורש תבנית Magic Link / OTP עם `{{ .Token }}` בדשבורד Supabase.
   */
  static async sendEmailOtp(email: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !trimmed.includes('@')) {
        return { success: false, error: 'invalid_email' };
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        console.error('[AuthService] sendEmailOtp failed:', error.message, (error as { code?: string }).code);
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('rate') || msg.includes('many') || msg.includes('too many')) {
          return { success: false, error: 'rate_limit' };
        }
        if (msg.includes('invalid') && msg.includes('email')) {
          return { success: false, error: 'invalid_email' };
        }
        // SMTP / Resend: 550 testing-only, domain not verified, template/send failures
        if (
          msg.includes('sending confirmation email') ||
          msg.includes('could not send email') ||
          msg.includes('error sending') ||
          msg.includes('smtp') ||
          msg.includes('550') ||
          msg.includes('resend') ||
          msg.includes('testing emails') ||
          msg.includes('verify a domain')
        ) {
          return { success: false, error: 'email_send_failed' };
        }
        return { success: false, error: 'email_send_failed' };
      }

      return { success: true, error: null };
    } catch (error: any) {
      console.error('[AuthService] sendEmailOtp exception:', error?.message);
      return { success: false, error: error?.message || 'email_send_failed' };
    }
  }

  /**
   * אימות OTP מאימייל — משאיר סשן פעיל (בניגוד לטלפון) כדי להמשיך רישום + set password.
   */
  static async verifyEmailOtp(
    email: string,
    token: string
  ): Promise<{ verified: boolean; userId: string | null; error: string | null }> {
    try {
      const trimmed = email.trim().toLowerCase();
      const cleanedToken = token.replace(/[^\d]/g, '');
      if (!trimmed) {
        return { verified: false, userId: null, error: 'invalid_email' };
      }
      if (cleanedToken.length !== 6) {
        return { verified: false, userId: null, error: 'invalid_otp' };
      }

      const { data, error } = await supabase.auth.verifyOtp({
        email: trimmed,
        token: cleanedToken,
        type: 'email',
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('invalid') || msg.includes('incorrect') || msg.includes('token')) {
          return { verified: false, userId: null, error: 'invalid_otp' };
        }
        if (msg.includes('expired') || msg.includes('expire')) {
          return { verified: false, userId: null, error: 'expired_otp' };
        }
        if (msg.includes('many') || msg.includes('attempts')) {
          return { verified: false, userId: null, error: 'too_many_attempts' };
        }
        if (msg.includes('network') || msg.includes('fetch')) {
          return { verified: false, userId: null, error: 'network_error' };
        }
        return { verified: false, userId: null, error: error.message || 'שגיאה באימות OTP' };
      }

      const userId = data.user?.id ?? null;
      if (!userId) {
        return { verified: false, userId: null, error: 'שגיאה באימות — לא התקבל משתמש' };
      }

      // חשוב לפני ש-onAuthStateChange/App מחליפים עץ ניווט:
      // מסמנים שהרישום לא הושלם (ברירת מחדל בטבלה false, אבל מוודאים מרוץ/timeout).
      try {
        await upsertOwnUserRow(
          userId,
          { registration_completed: false },
          { email: trimmed },
        );
      } catch {
        // לא חוסם אימות — ה-App גם בודק קונטקסט רישום
      }

      return { verified: true, userId, error: null };
    } catch (error: any) {
      return { verified: false, userId: null, error: error?.message || 'שגיאה באימות OTP' };
    }
  }

  static async resendEmailOtp(email: string): Promise<{ success: boolean; error: string | null }> {
    return this.sendEmailOtp(email);
  }

  /** הגדרת סיסמה למשתמש שמחובר אחרי אימות אימייל / recovery OTP. */
  static async setPasswordForCurrentUser(
    password: string
  ): Promise<{ success: boolean; error: string | null }> {
    const started = Date.now();
    try {
      if (!password || password.length < 6) {
        return { success: false, error: 'weak_password' };
      }

      // בדיקת סשן לפני updateUser — בלי זה מקבלים timeout מזויף כשאין JWT
      try {
        const { data: sessionData, error: sessionError } = await this.withAuthTimeout(
          supabase.auth.getSession(),
          8_000,
          'setPasswordForCurrentUser.getSession'
        );
        if (sessionError || !sessionData?.session?.access_token) {
          logger.warn('AuthService', 'setPasswordForCurrentUser: no session', {
            ms: Date.now() - started,
            err: sessionError?.message,
          });
          return { success: false, error: 'no_session' };
        }
      } catch (e: any) {
        const msg = String(e?.message || '');
        if (msg.startsWith('timeout:')) {
          logger.warn('AuthService', 'setPasswordForCurrentUser getSession timed out', {
            ms: Date.now() - started,
          });
          return { success: false, error: 'no_session' };
        }
        throw e;
      }

      // רק קריאת הרשת של updateUser — לא cleanup/signOut
      const { data, error } = await this.withAuthTimeout(
        supabase.auth.updateUser({ password }),
        25_000,
        'setPasswordForCurrentUser.updateUser'
      );

      logger.debug('AuthService', 'setPasswordForCurrentUser done', {
        ms: Date.now() - started,
        ok: !error && !!data?.user,
        error: error?.message ?? null,
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        logger.warn('AuthService', 'setPasswordForCurrentUser supabase error', {
          ms: Date.now() - started,
          message: error.message,
          status: (error as { status?: number }).status,
          code: (error as { code?: string }).code,
        });
        if (
          msg.includes('session') ||
          msg.includes('authenticated') ||
          msg.includes('jwt') ||
          msg.includes('not logged') ||
          msg.includes('auth session missing')
        ) {
          return { success: false, error: 'no_session' };
        }
        if (msg.includes('password') && (msg.includes('weak') || msg.includes('least'))) {
          return { success: false, error: 'weak_password' };
        }
        if (msg.includes('same') || msg.includes('different') || msg.includes('unchanged')) {
          return { success: false, error: 'יש לבחור סיסמה שונה מהקודמת' };
        }
        if (msg.includes('nonce') || msg.includes('reauth') || msg.includes('reauthentication')) {
          return {
            success: false,
            error: 'נדרש אימות מחדש לעדכון סיסמה. בקש קוד איפוס חדש.',
          };
        }
        return { success: false, error: error.message || 'שגיאה בשמירת הסיסמה' };
      }
      // בלי user בתשובה — לא מחשיבים הצלחה (מונע "נשמר" מדומה)
      if (!data?.user) {
        logger.warn('AuthService', 'setPasswordForCurrentUser: no user in response', {
          ms: Date.now() - started,
        });
        return { success: false, error: 'שגיאה בשמירת הסיסמה — לא התקבל אישור מהשרת' };
      }
      return { success: true, error: null };
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (msg.startsWith('timeout:')) {
        logger.warn('AuthService', 'setPasswordForCurrentUser timed out', {
          ms: Date.now() - started,
          label: msg,
        });
        return { success: false, error: 'timeout' };
      }
      logger.warn('AuthService', 'setPasswordForCurrentUser exception', {
        ms: Date.now() - started,
        message: error?.message,
      });
      return { success: false, error: error?.message || 'שגיאה בשמירת הסיסמה' };
    }
  }

  /**
   * סיום איפוס סיסמה אחרי recovery OTP:
   * updateUser → בדיקת error → signOut מקומי → signInWithPassword לאימות שהסיסמה
   * באמת נשמרה ב-auth.users → signOut נקי.
   * בלי שלב האימות אפשר לקבל "הצלחה" מדומה ואז כניסה חד-פעמית מסשן recovery.
   */
  static async completePasswordRecovery(
    password: string,
    emailHint?: string | null
  ): Promise<{ success: boolean; error: string | null }> {
    const started = Date.now();
    const normalizedHint = (emailHint || '').trim().toLowerCase();

    try {
      if (!password || password.length < 6) {
        return { success: false, error: 'weak_password' };
      }

      const { data: sessionData, error: sessionError } = await this.withAuthTimeout(
        supabase.auth.getSession(),
        8_000,
        'completePasswordRecovery.getSession'
      );
      if (sessionError || !sessionData?.session?.access_token) {
        logger.warn('AuthService', 'completePasswordRecovery: no session', {
          ms: Date.now() - started,
          err: sessionError?.message,
        });
        return { success: false, error: 'no_session' };
      }

      const email =
        normalizedHint ||
        (sessionData.session.user?.email || '').trim().toLowerCase();
      if (!email) {
        return { success: false, error: 'invalid_email' };
      }

      const updateResult = await this.setPasswordForCurrentUser(password);
      if (updateResult.error || !updateResult.success) {
        return updateResult;
      }

      // מנקים את סשן ה-recovery לפני אימות — אחרת "התחברות" עלולה להיות הסשן הישן
      const { error: signOutError } = await this.signOut();
      if (signOutError) {
        logger.warn('AuthService', 'completePasswordRecovery: signOut before verify failed', {
          signOutError,
        });
      }

      const { data: signInData, error: signInError } = await this.withAuthTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        20_000,
        'completePasswordRecovery.verifySignIn'
      );

      if (signInError || !signInData?.session?.user) {
        logger.warn('AuthService', 'completePasswordRecovery: password verify failed', {
          ms: Date.now() - started,
          message: signInError?.message ?? 'no session after signIn',
          status: (signInError as { status?: number } | null)?.status,
        });
        // מנקים שאריות אם נוצרו
        void this.signOut().catch(() => { /* ignore */ });
        return {
          success: false,
          error: 'password_not_persisted',
        };
      }

      // התחברות האימות הצליחה — מנתקים כדי לדרוש login מודע במסך Login
      const { error: finalSignOutError } = await this.signOut();
      if (finalSignOutError) {
        logger.warn('AuthService', 'completePasswordRecovery: final signOut failed', {
          finalSignOutError,
        });
      }

      logger.debug('AuthService', 'completePasswordRecovery ok', {
        ms: Date.now() - started,
      });
      return { success: true, error: null };
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (msg.startsWith('timeout:')) {
        logger.warn('AuthService', 'completePasswordRecovery timed out', {
          ms: Date.now() - started,
          label: msg,
        });
        void this.signOut().catch(() => { /* ignore */ });
        return { success: false, error: 'timeout' };
      }
      logger.warn('AuthService', 'completePasswordRecovery exception', {
        ms: Date.now() - started,
        message: error?.message,
      });
      void this.signOut().catch(() => { /* ignore */ });
      return { success: false, error: error?.message || 'שגיאה בשמירת הסיסמה' };
    }
  }

  /**
   * בדיקה אם המייל כבר רשום. נקראת גם לפני הרשמה (משתמש anon).
   * המימוש נשען על RPC `check_email_exists` (SECURITY DEFINER, מוענק ל-anon)
   * ולא על `auth.admin` — ל-admin API נדרש service role key שאסור שיהיה בקליינט.
   */
  static async checkEmailExists(email: string): Promise<{ exists: boolean; error: string | null }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return { exists: false, error: null };

    try {
      const { data, error } = await supabase.rpc('check_email_exists', {
        email_to_check: normalizedEmail,
      });

      // אין fallback לשאילתה ישירה: `authenticated`/`anon` לא יכולים לקרוא
      // את עמודת email, ולכן שאילתה כזו הייתה מחזירה 42501 ומדווחת בטעות
      // שהמייל פנוי. אם ה-RPC חסר — עדיף להיכשל גלוי.
      if (error) {
        console.error('[AuthService] check_email_exists failed:', error.message);
        return { exists: false, error: error.message };
      }

      return { exists: data === true, error: null };
    } catch (error: any) {
      console.error('[AuthService] checkEmailExists exception:', error?.message);
      return { exists: false, error: error?.message ?? 'שגיאה בבדיקת המייל' };
    }
  }

  // Check if phone already exists
  static async checkPhoneExists(phone: string): Promise<{ exists: boolean; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc('check_phone_exists', { phone_to_check: phone });
      if (error) return { exists: false, error: error.message };
      return { exists: data, error: null };
    } catch (error: any) {
      return { exists: false, error: error.message };
    }
  }

  /**
   * שליחת OTP לטלפון באמצעות Supabase Phone Auth (E.164 IL).
   * לא נאכף ברישום כל עוד PHONE_VERIFICATION_ENABLED=false.
   */
  static async sendPhoneOtp(phone: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const e164Phone = toE164IsraeliPhone(phone);
      if (!e164Phone) {
        return { success: false, error: 'invalid_phone' };
      }

      logger.info('AuthService', `Sending OTP to phone: ${e164Phone.replace(/\d{4}$/, '****')}`);

      const { error } = await supabase.auth.signInWithOtp({
        phone: e164Phone,
        options: {
          // יוצר auth.users זמני לטלפון — אחרי verify אנחנו signOut מקומי.
          shouldCreateUser: true,
        },
      });

      if (error) {
        logger.error('AuthService', 'Phone OTP error', error);

        const msg = (error.message || '').toLowerCase();
        const statusCode = (error as { status?: number }).status;

        if (msg.includes('rate') || msg.includes('many') || msg.includes('too many')) {
          return { success: false, error: 'rate_limit' };
        }
        if (msg.includes('invalid') && msg.includes('phone')) {
          return { success: false, error: 'invalid_phone' };
        }
        if (msg.includes('sms provider') || msg.includes('twilio') || statusCode === 500) {
          logger.error('AuthService', 'SMS provider error - check Twilio configuration', error);
          return { success: false, error: 'sms_provider_error' };
        }
        if (msg.includes('not configured') || msg.includes('phone auth')) {
          return { success: false, error: 'phone_auth_not_configured' };
        }

        return { success: false, error: error.message || 'שגיאה בשליחת OTP' };
      }

      logger.info('AuthService', 'OTP sent successfully');
      return { success: true, error: null };
    } catch (error: any) {
      logger.error('AuthService', 'Phone OTP exception', error);
      return { success: false, error: error.message || 'שגיאה בשליחת OTP' };
    }
  }

  /**
   * אימות OTP שנשלח לטלפון.
   */
  static async verifyPhoneOtp(
    phone: string,
    token: string
  ): Promise<{ verified: boolean; error: string | null }> {
    try {
      const e164Phone = toE164IsraeliPhone(phone);
      if (!e164Phone) {
        return { verified: false, error: 'invalid_phone' };
      }

      const cleanedToken = token.replace(/[^\d]/g, '');
      if (cleanedToken.length !== 6) {
        return { verified: false, error: 'invalid_otp' };
      }

      const { data, error } = await supabase.auth.verifyOtp({
        phone: e164Phone,
        token: cleanedToken,
        type: 'sms',
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('invalid') || msg.includes('incorrect') || msg.includes('token')) {
          return { verified: false, error: 'invalid_otp' };
        }
        if (msg.includes('expired') || msg.includes('expire')) {
          return { verified: false, error: 'expired_otp' };
        }
        if (msg.includes('many') || msg.includes('attempts')) {
          return { verified: false, error: 'too_many_attempts' };
        }
        if (msg.includes('network') || msg.includes('fetch')) {
          return { verified: false, error: 'network_error' };
        }
        return { verified: false, error: error.message || 'שגיאה באימות OTP' };
      }

      // אימות הצליח — מתנתקים מהסשן הזמני של ה-OTP בלי לגעת בשרת אם אפשר
      if (data.session) {
        await supabase.auth.signOut({ scope: 'local' });
      }

      return { verified: true, error: null };
    } catch (error: any) {
      return { verified: false, error: error.message || 'שגיאה באימות OTP' };
    }
  }

  /** מונע כפתור מסתובב לנצח כש-GoTrue/SMTP לא חוזרים */
  private static withAuthTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`timeout:${label}`));
      }, ms);
      Promise.resolve(promise).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  /**
   * שליחת מייל איפוס סיסמה (GoTrue /recover).
   * תבנית Recovery חייבת לכלול `{{ .Token }}` לזרימת OTP באפליקציה.
   * לא מאמת שהמייל באמת נשלח — רק שהבקשה התקבלה (הגנה מפני enumeration).
   */
  static async resetPasswordForEmail(email: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !trimmed.includes('@')) {
        return { success: false, error: 'invalid_email' };
      }

      const started = Date.now();
      const { error } = await this.withAuthTimeout(
        supabase.auth.resetPasswordForEmail(trimmed),
        20_000,
        'resetPasswordForEmail'
      );
      logger.debug('AuthService', 'resetPasswordForEmail done', {
        ms: Date.now() - started,
        ok: !error,
      });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('rate') || msg.includes('too many')) {
          return { success: false, error: 'rate_limit' };
        }
        if (msg.includes('invalid') && msg.includes('email')) {
          return { success: false, error: 'invalid_email' };
        }
        if (
          msg.includes('sending') ||
          msg.includes('could not send') ||
          msg.includes('smtp') ||
          msg.includes('550') ||
          msg.includes('resend')
        ) {
          return { success: false, error: 'email_send_failed' };
        }
        logger.error('AuthService', 'resetPasswordForEmail failed', error);
        return { success: false, error: error.message || 'שגיאה בשליחת מייל איפוס' };
      }

      return { success: true, error: null };
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (msg.startsWith('timeout:')) {
        logger.warn('AuthService', 'resetPasswordForEmail timed out');
        return { success: false, error: 'timeout' };
      }
      return { success: false, error: error.message || 'שגיאה בשליחת מייל איפוס' };
    }
  }

  /**
   * אימות קוד איפוס סיסמה מהמייל (תבנית Recovery + `{{ .Token }}`).
   * יוצר סשן recovery — אחריו קוראים ל-setPasswordForCurrentUser.
   */
  static async verifyRecoveryOtp(
    email: string,
    token: string
  ): Promise<{ verified: boolean; error: string | null }> {
    try {
      const trimmed = email.trim().toLowerCase();
      const cleanedToken = token.replace(/[^\d]/g, '');
      if (!trimmed) return { verified: false, error: 'invalid_email' };
      if (cleanedToken.length !== 6) return { verified: false, error: 'invalid_otp' };

      const started = Date.now();
      const { data, error } = await this.withAuthTimeout(
        supabase.auth.verifyOtp({
          email: trimmed,
          token: cleanedToken,
          type: 'recovery',
        }),
        20_000,
        'verifyRecoveryOtp'
      );
      logger.debug('AuthService', 'verifyRecoveryOtp done', {
        ms: Date.now() - started,
        ok: !error && !!data?.session?.user,
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('invalid') || msg.includes('incorrect') || msg.includes('token')) {
          return { verified: false, error: 'invalid_otp' };
        }
        if (msg.includes('expired') || msg.includes('expire')) {
          return { verified: false, error: 'expired_otp' };
        }
        if (msg.includes('many') || msg.includes('attempts')) {
          return { verified: false, error: 'too_many_attempts' };
        }
        return { verified: false, error: error.message || 'שגיאה באימות הקוד' };
      }

      if (!data.session?.user) {
        return { verified: false, error: 'שגיאה באימות — לא התקבל סשן' };
      }

      return { verified: true, error: null };
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (msg.startsWith('timeout:')) {
        logger.warn('AuthService', 'verifyRecoveryOtp timed out');
        return { verified: false, error: 'timeout' };
      }
      return { verified: false, error: error?.message || 'שגיאה באימות הקוד' };
    }
  }

  /**
   * שליחה מחדש של OTP לטלפון.
   */
  static async resendPhoneOtp(phone: string): Promise<{ success: boolean; error: string | null }> {
    // זהה ל-sendPhoneOtp
    return this.sendPhoneOtp(phone);
  }

  // Complete user registration with all data
  static async completeRegistration(registrationData: RegistrationData): Promise<{ success: boolean; error: string | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'משתמש לא מחובר' };

      const { data, error } = await supabase.rpc('complete_user_registration', {
        user_id: user.id,
        user_full_name: registrationData.full_name,
        user_phone: registrationData.phone,
        user_track_id: registrationData.track_id,
        user_intro_data: registrationData.intro_data
      });

      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: 'שגיאה בהשלמת ההרשמה' };

      return { success: true, error: null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * התנתקות מקומית (המכשיר הזה).
   * חשוב: ב-auth-js הנוכחי, כשל רשת ב-signOut עלול להחזיר error בלי למחוק את הסשן
   * מ-AsyncStorage — ואז אחרי restart המשתמש "נזכר". לכן תמיד מבטיחים ניקוי מקומי.
   * סדר: scrub storage קודם → signOut local → וידוא שאין session.
   */
  static async signOut(): Promise<{ error: string | null }> {
    logger.debug('AuthService', 'signOut called');
    try {
      // ניקוי כפוי קודם — גם אם הקריאה ל-GoTrue נכשלת / האפליקציה קורסת אחר כך
      try {
        await this.withAuthTimeout(clearPersistedAuthStorage(), 5_000, 'clearPersistedAuthStorage');
      } catch (e) {
        logger.warn('AuthService', 'clearPersistedAuthStorage timed out / failed', e);
      }
      logger.debug('AuthService', 'auth storage cleared', { key: supabaseAuthStorageKey() });

      try {
        // local = רק המכשיר הזה (לא מנתק סשנים במכשירים אחרים בטעות כשהשרת נכשל)
        const { error } = await this.withAuthTimeout(
          supabase.auth.signOut({ scope: 'local' }),
          8_000,
          'signOut.local'
        );
        if (error) {
          logger.warn('AuthService', 'signOut local returned error after scrub', error.message);
          // ניסיון חוזר אחרי scrub — מפיץ SIGNED_OUT מ-_removeSession
          try {
            await this.withAuthTimeout(
              supabase.auth.signOut({ scope: 'local' }),
              5_000,
              'signOut.local.retry'
            );
          } catch {
            /* ignore */
          }
        } else {
          logger.debug('AuthService', 'signOut local ok (SIGNED_OUT expected)');
        }
      } catch (error) {
        logger.warn('AuthService', 'signOut local threw after scrub', error);
        try {
          await this.withAuthTimeout(
            supabase.auth.signOut({ scope: 'local' }),
            5_000,
            'signOut.local.fallback'
          );
        } catch {
          /* ignore */
        }
      }

      try {
        const { data } = await this.withAuthTimeout(
          supabase.auth.getSession(),
          5_000,
          'signOut.getSession'
        );
        if (data.session) {
          logger.warn('AuthService', 'session still present after signOut — force scrub');
          try {
            await this.withAuthTimeout(clearPersistedAuthStorage(), 5_000, 'clearPersistedAuthStorage.retry');
          } catch {
            /* ignore */
          }
          try {
            await this.withAuthTimeout(
              supabase.auth.signOut({ scope: 'local' }),
              5_000,
              'signOut.local.force'
            );
          } catch {
            /* ignore */
          }
        } else {
          logger.debug('AuthService', 'signOut verified: no session');
        }
      } catch (e) {
        // getSession תקוע = הסיבה הנפוצה לספינר נצחי אחרי איפוס סיסמה
        logger.warn('AuthService', 'getSession after signOut timed out / failed — continuing', e);
      }

      return { error: null };
    } catch (error: any) {
      try {
        await clearPersistedAuthStorage();
      } catch {
        /* ignore */
      }
      logger.error('AuthService', 'signOut failed', error);
      return { error: error?.message ?? 'שגיאה בהתנתקות' };
    }
  }

  // Get current user
  static async getCurrentUser(): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return { user: null, error: null };
      const user = await this.getUserProfile(data.user.id);
      if (user) {
        return { user: await this.healRegistrationCompletedIfNeeded(user), error: null };
      }
      return { user: authUserToAppUser(data.user), error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  }

  /**
   * פרופיל המשתמש המחובר, כולל השדות הפרטיים (email/phone/intro_data).
   * `authenticated` איבד הרשאת SELECT על העמודות האלה ב-public.users כדי
   * שמשתמשים לא יקראו זה את הפרטים של זה, ולכן הקריאה עוברת דרך RPC
   * (SECURITY DEFINER) שנעול על auth.uid().
   */
  static async getUserProfile(userId: string): Promise<AuthUser | null> {
    const { data: rows, error } = await supabase.rpc('get_my_profile');
    const data = Array.isArray(rows) ? rows[0] : rows;
    if (error || !data || data.id !== userId) return null;
    
    return {
      id: data.id,
      email: data.email,
      display_name: data.display_name,
      displayName: data.display_name || data.full_name, // Alias: prefer display_name, fallback to full_name
      full_name: data.full_name,
      phone: data.phone,
      gender: data.gender,
      profile_picture: data.profile_picture,
      account_type: data.account_type,
      track_id: data.track_id,
      intro_data: data.intro_data,
      registration_completed: data.registration_completed,
      created_at: data.created_at ?? undefined
    };
  }

  /**
   * מתקן registration_completed=false כשיש ראיות ברורות שהרישום כבר הושלם
   * (סיכום/שאלון נשמרו) — מונע תקיעה ב-Onboarding אחרי login.
   * לא מרפאים רק בגלל תשלום באמצע onboarding.
   */
  static async healRegistrationCompletedIfNeeded(user: AuthUser): Promise<AuthUser> {
    if (user.registration_completed !== false) return user;
    if (!hasCompletedRegistrationEvidence(user)) return user;

    const { error } = await supabase
      .from('users')
      .update({
        registration_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) return user;
    return { ...user, registration_completed: true };
  }

  /**
   * האם הטלפון תפוס אצל משתמש אחר (לא כולל את userId).
   * עמודת `phone` לא קריאה יותר ל-`authenticated`, ולכן אי אפשר לשאול את
   * הטבלה ישירות — הבדיקה נשענת על check_phone_exists (רואה את כל הטבלה)
   * ועל get_my_profile כדי לוודא שהמספר לא פשוט שייך לי.
   */
  static async isPhoneTakenByOther(
    phone: string,
    userId: string,
  ): Promise<{ taken: boolean; error: string | null }> {
    const normalized = normalizeProfilePhone(phone);
    if (!normalized) return { taken: false, error: null };

    try {
      const { data: exists, error: rpcError } = await supabase.rpc('check_phone_exists', {
        phone_to_check: normalized,
      });
      if (rpcError) {
        // נמשיך ל־UPDATE; UNIQUE יתפוס אם צריך
        return { taken: false, error: null };
      }
      if (exists) {
        const { data: rows } = await supabase.rpc('get_my_profile');
        const me = Array.isArray(rows) ? rows[0] : rows;
        const myPhone = normalizeProfilePhone(me?.phone);
        if (myPhone !== normalized) {
          return { taken: true, error: null };
        }
      }
      return { taken: false, error: null };
    } catch {
      return { taken: false, error: null };
    }
  }

  // Update user profile (לא שולחים `id` ל־UPDATE — רק .eq)
  // עדכון אטומי: או שכל השדות נשמרים או כלום — אין מצב ששם נשמר וטלפון נכשל.
  static async updateProfile(updates: Partial<AuthUser>): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const id = updates.id;
      if (!id) {
        return { user: null, error: 'מזהה משתמש חסר' };
      }

      const payload: Record<string, unknown> = {};
      if (updates.display_name !== undefined) payload.display_name = updates.display_name;
      if (updates.full_name !== undefined) payload.full_name = updates.full_name;
      if (updates.phone !== undefined) {
        payload.phone = normalizeProfilePhone(updates.phone);
      }
      if (updates.gender !== undefined) {
        payload.gender = updates.gender;
      }
      if (updates.profile_picture !== undefined) {
        payload.profile_picture = updates.profile_picture || null;
      }
      // account_type נשמט בכוונה: היא עמודת הרשאה (useSubscription נופל אליה
      // כשאין רשומת מנוי) ולכן חסומה לכתיבה מהקליינט. שינוי מסלול עובר
      // ב-webhook של Cardcom או בפאנל הניהול.
      if (updates.track_id !== undefined) payload.track_id = updates.track_id;
      if (updates.intro_data !== undefined) payload.intro_data = updates.intro_data;
      if (updates.registration_completed !== undefined) {
        payload.registration_completed = updates.registration_completed;
      }

      // בדיקה מוקדמת לפני UPDATE — מונע שגיאת Postgres גולמית ומבלבול UI
      if (typeof payload.phone === 'string' && payload.phone.length > 0) {
        const { taken } = await this.isPhoneTakenByOther(payload.phone, id);
        if (taken) {
          return { user: null, error: PHONE_TAKEN_HE };
        }
      }

      const { error } = await supabase.from('users').update(payload).eq('id', id);
      if (error) {
        return { user: null, error: mapProfileUpdateError(error) };
      }

      const user = await this.getUserProfile(id);
      if (!user) {
        return { user: null, error: 'העדכון נרשם אבל לא נטען הפרופיל — נסה שוב' };
      }
      return { user, error: null };
    } catch (error: unknown) {
      return { user: null, error: mapProfileUpdateError(error) };
    }
  }

  // Sign in with Google OAuth
  static async signInWithGoogle(): Promise<{ 
    user: AuthUser | null; 
    error: string | null;
    isNewUser?: boolean;
    googleUser?: { id: string; email: string; fullName: string; profileImage: string | null };
  }> {
    if (googleOAuthFlowLock) {
      return { user: null, error: 'ההתחברות כבר מתבצעת — המתן לסיום' };
    }
    googleOAuthFlowLock = true;
    try {
      // makeRedirectUri + native: בבילד אמיתי מחזירים בדיוק com.darkpool.app://oauth (תיעוד Supabase).
      // בלי native, createURL עלול להחזיר com.darkpool.app:/oauth — ואז ב-Android ה-deep link
      // com.darkpool.app://oauth?code=... לא מתחיל ב-returnUrl והזרימה נכשלת.
      const redirectUrl = makeRedirectUri({
        scheme: 'com.darkpool.app',
        path: 'oauth',
        native: GOOGLE_OAUTH_REDIRECT_NATIVE,
      });
      if (__DEV__) {
        logger.info('AuthService', `Google OAuth redirectTo: ${redirectUrl}`);
      }

      // Start OAuth flow
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        return { user: null, error: error.message || 'שגיאה בהתחברות עם Google' };
      }

      if (!data.url) {
        return { user: null, error: 'שגיאה - לא התקבל URL לאימות' };
      }

      // Open browser for OAuth - Supabase will handle the callback via deep linking
      const result = (await openAuthSessionAsync(data.url, redirectUrl, {
        preferEphemeralSession: true,
      })) as WebBrowserAuthSessionResult;

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { user: null, error: 'ההתחברות בוטלה' };
      }

      // PKCE: חובה להעביר ל-exchangeCodeForSession רק את ה-authorization code (לא את כל ה-URL)
      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        const errParam =
          typeof parsed.queryParams?.error_description === 'string'
            ? parsed.queryParams.error_description
            : typeof parsed.queryParams?.error === 'string'
              ? parsed.queryParams.error
              : null;
        if (errParam) {
          return { user: null, error: errParam };
        }

        const code = extractPkceCodeFromCallbackUrl(result.url);
        if (!code) {
          return { user: null, error: 'לא התקבל קוד אימות מהדפדפן — נסה שוב' };
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

        if (sessionError || !sessionData.user) {
          return { user: null, error: sessionError?.message || 'שגיאה בהגדרת הסשן' };
        }

        // Check if user exists in our database / השלים רישום
        const existingUser = await this.getUserProfile(sessionData.user.id);
        const createdMs = new Date(sessionData.user.created_at).getTime();
        const justCreatedAccount = Number.isFinite(createdMs) && Date.now() - createdMs < 5 * 60 * 1000;
        const emptyIntro =
          !existingUser?.intro_data ||
          (typeof existingUser.intro_data === 'object' &&
            Object.keys(existingUser.intro_data as object).length === 0);

        // טריגר on_auth_user_created עלול ליצור שורה ריקה לפני הבדיקה —
        // יוצרים/משלימים פרופיל רק כשאין שורה, או כשזה stub טרי בלי השלמה.
        // חשוב: לא לעשות upsert מדכא על משתמש קיים (מוחק subscription / כופה false מחדש).
        const needsProfileBootstrap = !existingUser;
        const needsStubCompletion =
          !!existingUser &&
          justCreatedAccount &&
          existingUser.registration_completed !== true &&
          emptyIntro;

        if (needsProfileBootstrap || needsStubCompletion) {
          // account_type / subscription_* לא נכתבים כאן: ברירת המחדל בטבלה היא
          // free/free_user, ועדכון המנוי שייך ל-webhook בלבד.
          await upsertOwnUserRow(
            sessionData.user.id,
            {
              display_name:
                existingUser?.display_name ||
                sessionData.user.user_metadata?.full_name ||
                sessionData.user.email?.split('@')[0],
              full_name:
                existingUser?.full_name ||
                sessionData.user.user_metadata?.full_name ||
                sessionData.user.email?.split('@')[0],
              profile_picture:
                existingUser?.profile_picture ||
                sessionData.user.user_metadata?.avatar_url ||
                null,
              registration_completed: false,
            },
            { email: sessionData.user.email },
          );
        }

        let user = await this.getUserProfile(sessionData.user.id);
        if (!user) {
          return { user: null, error: 'שגיאה בטעינת פרופיל המשתמש' };
        }

        user = await this.healRegistrationCompletedIfNeeded(user);

        // Onboarding רק למי שלא סיים רישום (חדש / באמצע) — לא לכל Google login
        const isNewUser = user.registration_completed === false;

        return {
          user,
          error: null,
          isNewUser,
          googleUser: {
            id: user.id,
            email: user.email,
            fullName: user?.full_name || user?.display_name || '',
            profileImage: user?.profile_picture || null,
          },
        };
      }

      return { user: null, error: 'שגיאה בהתחברות עם Google' };
    } catch (error: any) {
      return { user: null, error: error.message || 'שגיאה בהתחברות עם Google' };
    } finally {
      googleOAuthFlowLock = false;
    }
  }

  // Listen to auth state changes
  static onAuthStateChange(callback: (user: AuthUser | null, event: AuthChangeEvent) => void) {
    // CRITICAL: אל תעשו await על supabase.auth.* / RPC מתוך ה-callback של GoTrue.
    // updateUser מחזיק auth lock וממתין שכל ה-subscribers יסיימו — ו-RPC קורא
    // ל-getSession שצריך את אותו lock → deadlock (TIMEOUT מזויף אחרי 20s).
    // דחייה ב-setTimeout(0) משחררת את ה-lock לפני טעינת פרופיל.
    // ראו: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
    return supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        void (async () => {
          if (event === 'SIGNED_OUT') {
            callback(null, event);
            return;
          }

          if (event === 'PASSWORD_RECOVERY' && session?.user) {
            try {
              const profile = await this.getUserProfile(session.user.id);
              callback(profile || authUserToAppUser(session.user), event);
            } catch {
              callback(authUserToAppUser(session.user), event);
            }
            return;
          }

          if (session?.user) {
            try {
              const getUserProfilePromise = this.getUserProfile(session.user.id);
              const timeoutPromise = new Promise<null>((resolve) => {
                setTimeout(() => resolve(null), 5000);
              });

              let user = await Promise.race([getUserProfilePromise, timeoutPromise]);

              if (!user) {
                await new Promise((r) => setTimeout(r, 400));
                user = await this.getUserProfile(session.user.id);
              }

              if (user) {
                callback(await this.healRegistrationCompletedIfNeeded(user), event);
              } else {
                callback(authUserToAppUser(session.user), event);
              }
            } catch {
              callback(authUserToAppUser(session.user), event);
            }
          } else {
            callback(null, event);
          }
        })();
      }, 0);
    });
  }
} 