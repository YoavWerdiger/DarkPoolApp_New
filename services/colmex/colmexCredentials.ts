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
 * שומר username ו-password ב-SecureStore.
 * הסיסמה נשמרת מוצפנת, מוגנת ב-biometrics/PIN אם מוגדר ע"י המשתמש.
 *
 * ⚠️  קרא את הערת האבטחה בראש הקובץ לפני שימוש.
 */
export async function saveColmexCredentials(
  username: string,
  password: string
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEY_USERNAME, username, SECURE_OPTIONS),
    SecureStore.setItemAsync(KEY_PASSWORD, password, SECURE_OPTIONS),
  ]);
}

/**
 * שולף credentials שמורים.
 * מחזיר null אם אין credentials שמורים.
 */
export async function getColmexCredentials(): Promise<{
  username: string;
  password: string;
} | null> {
  const [username, password] = await Promise.all([
    SecureStore.getItemAsync(KEY_USERNAME, SECURE_OPTIONS),
    SecureStore.getItemAsync(KEY_PASSWORD, SECURE_OPTIONS),
  ]);
  if (!username || !password) return null;
  return { username, password };
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
