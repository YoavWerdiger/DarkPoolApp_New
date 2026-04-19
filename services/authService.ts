import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { openAuthSessionAsync, WebBrowserAuthSessionResult } from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { logger } from '../utils/logger';
import { SUPABASE_URL } from '../config/publicEnv';

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

/** כשהפרופיל מ־public.users לא זמין בזמן (רשת איטית וכו') — לא מנתקים סשן תקף */
function authUserToAppUser(u: SupabaseAuthUser): AuthUser {
  const meta = (u.user_metadata || {}) as Record<string, unknown>;
  const email = u.email ?? '';
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.display_name === 'string' && meta.display_name) ||
    email.split('@')[0] ||
    '';
  return {
    id: u.id,
    email,
    display_name: (typeof meta.display_name === 'string' && meta.display_name) || name || undefined,
    full_name: (typeof meta.full_name === 'string' && meta.full_name) || name || undefined,
    profile_picture:
      typeof meta.avatar_url === 'string'
        ? meta.avatar_url
        : typeof meta.profile_picture === 'string'
          ? meta.profile_picture
          : undefined,
  };
}

export interface AuthUser {
  id: string;
  email: string;
  display_name?: string;
  full_name?: string;
  phone?: string;
  gender?: 'male' | 'female';
  profile_picture?: string;
  account_type?: string;
  track_id?: string;
  intro_data?: any;
  registration_completed?: boolean;
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
}

export interface RegistrationData {
  full_name: string;
  phone: string;
  track_id: string;
  intro_data: {
    markets: string[];
    experience: string;
    styles: string[];
    brokers: string[];
    level: string;
    goal: string;
    communityGoals: string[];
    hours: string;
    socials: string[];
    heardFrom: string;
    wish: string;
  };
}

export class AuthService {
  // Sign in with email and password
  static async signIn({ email, password }: LoginCredentials): Promise<{ user: AuthUser | null; error: string | null }> {
    const maxRetries = 3;
    let lastError: any = null;

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

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
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
        
        return { user, error: null };
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
    intro_data
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
      
      // אם יש שגיאה ב-auth.signUp, ננסה ליצור משתמש ישירות
      if (error || !data.user) {
        
        // יצירת UUID עבור המשתמש
        const userId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
        
        // ניסיון ליצור משתמש ישירות בטבלת users (בלי auth.users)
        const userData: any = {
          id: userId,
          email: email,
          display_name: display_name,
          full_name: full_name || display_name,
          profile_picture: profile_picture || null,
          track_id: track_id || '1',
          intro_data: intro_data || {},
          account_type: account_type || 'free',
          registration_completed: true
        };

        // הוספת טלפון רק אם הוא קיים ובפורמט נכון
        if (phone && phone.trim()) {
          const cleanPhone = phone.replace(/[^\d]/g, '');
          if (cleanPhone.length >= 10 && cleanPhone.length <= 15) {
            userData.phone = cleanPhone;
          }
        }

        const { data: insertData, error: insertError } = await supabase.from('users').insert(userData).select();
        
        if (insertError) {
          return { user: null, error: `Database error: ${insertError.message}` };
        }
        
        // החזרת משתמש מותאם
        const createdUser = insertData?.[0];
        if (createdUser) {
          const finalUser: AuthUser = {
            id: createdUser.id,
            email: createdUser.email,
            display_name: createdUser.display_name,
            full_name: createdUser.full_name,
            phone: createdUser.phone,
            profile_picture: createdUser.profile_picture,
            account_type: createdUser.account_type,
            track_id: createdUser.track_id,
            intro_data: createdUser.intro_data,
            registration_completed: createdUser.registration_completed
          };
          return { user: finalUser, error: null };
        }
        
        return { user: null, error: 'Failed to create user profile' };
      }
      
      // יצירת משתמש בטבלת users עם כל הנתונים
      const userData: any = {
        id: data.user.id,
        email: data.user.email,
        display_name: display_name,
        full_name: full_name || display_name,
        profile_picture: profile_picture || null,
        track_id: track_id || '1', // default למסלול מתחילים
        intro_data: intro_data || {},
        account_type: account_type || 'free',
        registration_completed: true // נסמן שההרשמה הושלמה
      };

      // הוספת טלפון רק אם הוא קיים ובפורמט נכון
      if (phone && phone.trim()) {
        // הסרת תווים לא רצויים מהטלפון
        const cleanPhone = phone.replace(/[^\d]/g, '');
        if (cleanPhone.length >= 10 && cleanPhone.length <= 15) {
          userData.phone = cleanPhone;
        }
      }

      const { data: insertData, error: insertError } = await supabase.from('users').insert(userData).select();
      
      if (insertError) {
        return { user: null, error: `Database error: ${insertError.message}` };
      }
      
      const finalUser = await this.getUserProfile(data.user.id);
      return { user: finalUser, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  }

  // Check if email already exists
  static async checkEmailExists(email: string): Promise<{ exists: boolean; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc('check_email_exists', { email_to_check: email });
      if (error) return { exists: false, error: error.message };
      return { exists: data, error: null };
    } catch (error: any) {
      return { exists: false, error: error.message };
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

  // Sign out
  static async signOut(): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { error: error.message || null };
      }
      return { error: null };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  // Get current user
  static async getCurrentUser(): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return { user: null, error: null };
      const user = await this.getUserProfile(data.user.id);
      if (user) return { user, error: null };
      return { user: authUserToAppUser(data.user), error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  }

  // Get user profile from public.users
  static async getUserProfile(userId: string): Promise<AuthUser | null> {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error || !data) return null;
    return {
      id: data.id,
      email: data.email,
      display_name: data.display_name,
      full_name: data.full_name,
      phone: data.phone,
      gender: data.gender,
      profile_picture: data.profile_picture,
      account_type: data.account_type,
      track_id: data.track_id,
      intro_data: data.intro_data,
      registration_completed: data.registration_completed
    };
  }

  // Update user profile
  static async updateProfile(updates: Partial<AuthUser>): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const { data, error } = await supabase.from('users').update(updates).eq('id', updates.id).select().single();
      if (error || !data) return { user: null, error: error?.message || 'שגיאה בעדכון' };
      return { user: data, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
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

        // Check if user exists in our database
        const existingUser = await this.getUserProfile(sessionData.user.id);
        const isNewUser = !existingUser;

        if (isNewUser) {
          await supabase.from('users').insert({
            id: sessionData.user.id,
            email: sessionData.user.email,
            display_name: sessionData.user.user_metadata?.full_name || sessionData.user.email?.split('@')[0],
            full_name: sessionData.user.user_metadata?.full_name || sessionData.user.email?.split('@')[0],
            profile_picture: sessionData.user.user_metadata?.avatar_url || null,
          });
        }

        const user = await this.getUserProfile(sessionData.user.id);
        if (!user) {
          return { user: null, error: 'שגיאה בטעינת פרופיל המשתמש' };
        }

        return {
          user,
          error: null,
          isNewUser,
          googleUser: {
            id: user.id,
            email: user.email,
            fullName: user.full_name || user.display_name || '',
            profileImage: user.profile_picture || null,
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
  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      // אם זה SIGNED_OUT event, תמיד נקרא callback(null)
      if (event === 'SIGNED_OUT') {
        callback(null);
        return;
      }
      
      if (session?.user) {
        try {
          // הוספת timeout ל-getUserProfile כדי למנוע תקיעות
          const getUserProfilePromise = this.getUserProfile(session.user.id);
          const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
              resolve(null);
            }, 5000); // 5 שניות timeout
          });
          
          const user = await Promise.race([getUserProfilePromise, timeoutPromise]);

          if (user) {
            callback(user);
          } else {
            // סשן תקף אבל הפרופיל לא נטען בזמן (timeout / שורה חסרה / רשת) — לא מנתקים
            callback(authUserToAppUser(session.user));
          }
        } catch {
          callback(authUserToAppUser(session.user));
        }
      } else {
        // אם אין session או אין user, נקרא callback(null)
        // גם ב-INITIAL_SESSION, כדי שהאפליקציה תוכל להמשיך
        callback(null);
      }
    });
  }
} 