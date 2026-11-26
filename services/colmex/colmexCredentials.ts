/**
 * services/colmex/colmexCredentials.ts
 * --------------------------------------------------------------------------
 * אחסון מאובטח של credentials ו-session tokens ב-expo-secure-store.
 *
 * ⚠️  הערה חשובה לאבטחה:
 *   - אין לאחסן credentials בגרסה production ב-AsyncStorage רגיל.
 *   - SecureStore מצפין באמצעות Keychain (iOS) / Keystore (Android).
 *   - credentials בפועל מאוחסנים גם ב-Supabase Vault (צד-שרת) דרך
 *     ה-Edge Function broker-colmex-connect. הקובץ הזה מספק גישה
 *     מהירה local עבור:
 *     • auto-reconnect UI (auto-fill username)
 *     • בדיקת session קיים לפני קריאה לשרת
 *
 * אין לגשת ל-API של Colmex ישירות מה-App —
 * כל קריאות API עוברות דרך Edge Functions.
 */

import * as SecureStore from 'expo-secure-store';
import type { ColmexSession } from './colmexTypes';
import { silent } from '../../utils/silentError';

// --------------------------------------------------------------------------
// Storage keys
// --------------------------------------------------------------------------

const KEY_USERNAME = 'colmex:username';
const KEY_PASSWORD = 'colmex:password';
const KEY_SESSION  = 'colmex:session';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// --------------------------------------------------------------------------
// Credentials
// --------------------------------------------------------------------------

/**
 * שומר רק את שם המשתמש (לנוחות ה-UI). הסיסמה של Colmex לא נשמרת על המכשיר בשום מצב —
 * היא נשלחת פעם אחת ל-broker-colmex-connect ונשמרת ב-Supabase Vault.
 * מוחק גם סיסמה שנשמרה בגרסאות ישנות.
 */
export async function saveColmexUsername(username: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEY_USERNAME, username, SECURE_OPTIONS),
    SecureStore.deleteItemAsync(KEY_PASSWORD, SECURE_OPTIONS),
  ]);
}

export async function getColmexUsername(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_USERNAME, SECURE_OPTIONS);
}

/** מוחק סיסמה שנשמרה במכשיר בגרסאות ישנות (נקרא בהפעלה). */
export async function purgeLegacyColmexPassword(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PASSWORD, SECURE_OPTIONS).catch(silent('colmexCredentials'));
}

/**
 * מוחק את ה-credentials המאוחסנים.
 * קרא לזה בעת disconnect.
 */
export async function clearColmexCredentials(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_USERNAME, SECURE_OPTIONS),
    SecureStore.deleteItemAsync(KEY_PASSWORD, SECURE_OPTIONS),
  ]);
}

// --------------------------------------------------------------------------
// Session token (cache מקומי לבדיקת תוקף)
// --------------------------------------------------------------------------

/**
 * שומר session token מקומית לצורך בדיקת תוקף מהירה.
 * ה-token האמיתי מאוחסן ב-Supabase Vault — זה רק cache.
 */
export async function saveColmexSession(session: ColmexSession): Promise<void> {
  await SecureStore.setItemAsync(
    KEY_SESSION,
    JSON.stringify(session),
    SECURE_OPTIONS
  );
}

/**
 * שולף session token שמור.
 * מחזיר null אם אין session שמור או אם ה-JSON פגום.
 */
export async function getColmexSession(): Promise<ColmexSession | null> {
  const raw = await SecureStore.getItemAsync(KEY_SESSION, SECURE_OPTIONS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ColmexSession;
  } catch {
    return null;
  }
}

/**
 * מוחק session token מקומי.
 */
export async function clearColmexSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_SESSION, SECURE_OPTIONS);
}

/**
 * מוחק את כל נתוני ה-Colmex השמורים מקומית.
 */
export async function clearAllColmexLocal(): Promise<void> {
  await Promise.all([
    clearColmexCredentials(),
    clearColmexSession(),
  ]);
}

/**
 * בדיקה אם יש session פעיל מקומית (לא בודק מול שרת).
 */
export async function hasValidLocalSession(): Promise<boolean> {
  const session = await getColmexSession();
  if (!session) return false;
  return session.expiresAt > Date.now();
}
