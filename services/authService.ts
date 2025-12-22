import { supabase } from './supabase';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Complete the auth session for better UX
WebBrowser.maybeCompleteAuthSession();

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
        console.log(`🔄 AuthService: Attempting sign in (attempt ${attempt}/${maxRetries}) with email:`, email);
        
        // בדיקה בסיסית של חיבור לאינטרנט לפני הבקשה
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // timeout של 5 שניות
          
          const testResponse = await fetch('https://wpmrtczbfcijoocguime.supabase.co', { 
            method: 'HEAD',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          console.log('✅ AuthService: Network connectivity check passed');
        } catch (networkError: any) {
          console.error('❌ AuthService: Network connectivity check failed:', networkError);
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
          console.error('❌ AuthService: Supabase auth error:', error.message, error.status);
          lastError = error;
          
          // טיפול מיוחד בשגיאות רשת
          if (error.message?.includes('Network request failed') || 
              error.message?.includes('fetch') || 
              error.status === 0 ||
              error.status === null) {
            if (attempt < maxRetries) {
              console.log(`🔄 AuthService: Retrying in ${attempt} second(s)...`);
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
          console.error('❌ AuthService: No user data returned');
          return { user: null, error: 'שגיאה בהתחברות - אין נתוני משתמש' };
        }
        
        console.log('✅ AuthService: Auth successful, fetching user profile...');
        const user = await this.getUserProfile(data.user.id);
        if (!user) {
          console.error('❌ AuthService: Failed to fetch user profile');
          return { user: null, error: 'שגיאה בטעינת פרופיל המשתמש' };
        }
        
        console.log('✅ AuthService: Sign in completed successfully');
        return { user, error: null };
      } catch (error: any) {
        console.error(`❌ AuthService: Sign in exception (attempt ${attempt}):`, error);
        lastError = error;
        const errorMessage = error?.message || String(error);
        
        if ((errorMessage.includes('Network request failed') || 
             errorMessage.includes('fetch') ||
             errorMessage.includes('AbortError')) && 
            attempt < maxRetries) {
          console.log(`🔄 AuthService: Retrying in ${attempt} second(s)...`);
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
    console.log('🔄 AuthService: signUp called with:', { email, display_name, account_type });
    try {
      // בדיקה אם המייל כבר קיים
      console.log('🔄 AuthService: Checking if email exists...');
      const { exists, error: checkError } = await this.checkEmailExists(email);
      if (checkError) {
        console.error('❌ AuthService: Error checking email:', checkError);
      } else {
        console.log('🔄 AuthService: Email exists check result:', exists);
        if (exists) {
          return { user: null, error: 'כתובת המייל כבר קיימת במערכת' };
        }
      }

      // ניסיון ראשון: הרשמה רגילה
      console.log('🔄 AuthService: Calling supabase.auth.signUp...');
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
      
      console.log('🔄 AuthService: supabase.auth.signUp result:', { 
        hasUser: !!data?.user, 
        userId: data?.user?.id, 
        error: error?.message 
      });
      
      // אם יש שגיאה ב-auth.signUp, ננסה ליצור משתמש דרך Admin API
      if (error || !data.user) {
        console.log('🔄 AuthService: auth.signUp failed, trying admin API user creation...');
        console.log('🔄 AuthService: Error details:', error?.message);
        
        try {
          // קריאה ל-Edge Function שיוצר משתמש ב-auth.users דרך Admin API
          console.log('🔄 AuthService: Invoking create-user-admin function...');
          const { data: functionData, error: functionError } = await supabase.functions.invoke('create-user-admin', {
            body: {
              email,
              password,
              display_name,
              full_name: full_name || display_name,
              phone: phone || null,
              track_id: track_id || '1',
              account_type: account_type || 'free',
              intro_data: intro_data || {}
            }
          });

          console.log('🔄 AuthService: Function response:', { 
            functionData, 
            functionError,
            hasData: !!functionData,
            dataType: typeof functionData,
            errorType: typeof functionError,
            errorMessage: functionError?.message,
            errorDetails: functionError
          });

          if (functionError) {
            console.error('❌ AuthService: Admin API function error:', functionError);
            
            // ניסיון לחלץ את כל המאפיינים של השגיאה
            const errorAny = functionError as any;
            const allProps = Object.getOwnPropertyNames(errorAny);
            const allKeys = Object.keys(errorAny);
            
            console.error('❌ AuthService: Error details:', {
              name: errorAny?.name,
              message: errorAny?.message,
              stack: errorAny?.stack,
              context: errorAny?.context,
              status: errorAny?.status,
              statusCode: errorAny?.statusCode,
              code: errorAny?.code,
              response: errorAny?.response,
              allProps,
              allKeys,
              errorAnyKeys: Object.keys(errorAny),
              errorAnyValues: allProps.reduce((acc: any, prop: string) => {
                try {
                  acc[prop] = errorAny[prop];
                } catch (e) {
                  acc[prop] = '[cannot access]';
                }
                return acc;
              }, {})
            });
            
            // ניסיון לחלץ מידע נוסף מהשגיאה
            let errorMessage = 'שגיאה ביצירת המשתמש';
            if (functionError.message) {
              errorMessage = functionError.message;
            } else if (typeof functionError === 'string') {
              errorMessage = functionError;
            } else if (functionError instanceof Error) {
              errorMessage = functionError.message;
            }
            
            // בדיקה אם יש status code בשגיאה - נבדוק בכל המקומות האפשריים
            const statusCode = errorAny?.status || 
                             errorAny?.statusCode || 
                             errorAny?.code ||
                             errorAny?.context?.status ||
                             errorAny?.response?.status ||
                             (errorAny?.response?.statusCode);
            if (statusCode) {
              console.error(`❌ AuthService: Edge Function returned status code: ${statusCode}`);
              if (statusCode === 400) {
                // ננסה לקבל את הפרטים מהתגובה
                if (functionData?.code === 'USER_EXISTS' || functionData?.error?.includes('already exists')) {
                  errorMessage = 'כתובת המייל כבר קיימת במערכת.';
                } else if (functionData?.code === 'AUTH_CREATE_FAILED') {
                  errorMessage = `שגיאה ביצירת המשתמש: ${functionData?.error || 'אנא נסה שוב'}`;
                } else if (functionData?.code === 'PROFILE_CREATE_FAILED') {
                  errorMessage = `שגיאה ביצירת הפרופיל: ${functionData?.error || 'אנא נסה שוב'}`;
                } else {
                  errorMessage = 'הנתונים שהוזנו לא תקינים. אנא בדוק את הפרטים ונסה שוב.';
                }
              } else if (statusCode === 401 || statusCode === 403) {
                errorMessage = 'בעיית הרשאות. אנא פנה לתמיכה.';
              } else if (statusCode === 409) {
                errorMessage = 'כתובת המייל כבר קיימת במערכת.';
              } else if (statusCode >= 500) {
                if (functionData?.code === 'CONFIG_ERROR') {
                  errorMessage = 'שגיאת הגדרות שרת. אנא פנה לתמיכה.';
                } else {
                  errorMessage = 'שגיאת שרת. אנא נסה שוב בעוד כמה רגעים.';
                }
              } else {
                errorMessage = `שגיאה ביצירת המשתמש (קוד: ${statusCode}). אנא נסה שוב או פנה לתמיכה.`;
              }
            } else if (errorMessage.includes('Network request failed') || errorMessage.includes('fetch')) {
              errorMessage = 'בעיית חיבור. אנא בדוק את החיבור לאינטרנט ונסה שוב.';
            } else if (errorMessage.includes('non-2xx status code')) {
              // נסה לקבל את ה-status code מה-message
              const statusMatch = errorMessage.match(/status code:? (\d+)/i);
              const extractedStatus = statusMatch ? statusMatch[1] : null;
              if (extractedStatus) {
                const code = parseInt(extractedStatus);
                if (code === 400) {
                  errorMessage = 'הנתונים שהוזנו לא תקינים. אנא בדוק את הפרטים ונסה שוב.';
                } else if (code === 409) {
                  errorMessage = 'כתובת המייל כבר קיימת במערכת.';
                } else if (code >= 500) {
                  errorMessage = 'שגיאת שרת. אנא נסה שוב בעוד כמה רגעים.';
                } else {
                  errorMessage = `שגיאה ביצירת המשתמש (קוד: ${code}). אנא נסה שוב או פנה לתמיכה.`;
                }
              } else {
                errorMessage = 'שגיאה ביצירת המשתמש. אנא נסה שוב או פנה לתמיכה.';
              }
            }
            
            return { user: null, error: errorMessage };
          }

          // בדיקה אם יש שגיאה בתגובה
          if (functionData?.error) {
            console.error('❌ AuthService: Admin API returned error:', functionData.error);
            const errorMsg = typeof functionData.error === 'string' 
              ? functionData.error 
              : functionData.error?.message || 'שגיאה ביצירת המשתמש';
            return { user: null, error: errorMsg };
          }
          
          // בדיקה אם התגובה ריקה או לא תקינה
          if (!functionData) {
            console.error('❌ AuthService: Function returned empty response');
            return { user: null, error: 'השרת לא החזיר תגובה. אנא נסה שוב.' };
          }

          // בדיקה אם יש user בתגובה
          if (functionData?.user) {
            console.log('✅ AuthService: User created via Admin API:', functionData.user);
            
            // התחברות אוטומטית למשתמש שנוצר
            console.log('🔄 AuthService: Attempting to sign in with created user...');
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email,
              password
            });

            if (signInError || !signInData.user) {
              console.error('❌ AuthService: Failed to sign in after user creation:', signInError);
              // אם ההתחברות נכשלה, נחזיר את המשתמש שנוצר אבל נציין שצריך להתחבר ידנית
              return { 
                user: {
                  id: functionData.user.id,
                  email: functionData.user.email || email,
                  display_name: functionData.user.display_name,
                  full_name: functionData.user.full_name,
                  phone: functionData.user.phone,
                  profile_picture: functionData.user.profile_picture,
                  account_type: functionData.user.account_type,
                  track_id: functionData.user.track_id,
                  intro_data: functionData.user.intro_data,
                  registration_completed: functionData.user.registration_completed
                }, 
                error: signInError ? `User created but sign in failed: ${signInError.message}. Please try logging in manually.` : null 
              };
            }

            console.log('✅ AuthService: Sign in successful, fetching user profile...');
            // קבלת פרופיל המשתמש
            const finalUser = await this.getUserProfile(signInData.user.id);
            if (!finalUser) {
              console.warn('⚠️ AuthService: getUserProfile returned null, using functionData user');
              // אם getUserProfile נכשל, נחזיר את המשתמש מה-functionData
              return { 
                user: {
                  id: functionData.user.id,
                  email: functionData.user.email || email,
                  display_name: functionData.user.display_name,
                  full_name: functionData.user.full_name,
                  phone: functionData.user.phone,
                  profile_picture: functionData.user.profile_picture,
                  account_type: functionData.user.account_type,
                  track_id: functionData.user.track_id,
                  intro_data: functionData.user.intro_data,
                  registration_completed: functionData.user.registration_completed
                }, 
                error: null 
              };
            }
            console.log('✅ AuthService: User profile fetched successfully');
            return { user: finalUser, error: null };
          }

          console.error('❌ AuthService: No user in function response:', functionData);
          return { user: null, error: 'Failed to create user via Admin API - no user returned in response' };
        } catch (adminError: any) {
          console.error('❌ AuthService: Admin API exception:', adminError);
          return { user: null, error: `Failed to create user: ${adminError?.message || JSON.stringify(adminError)}` };
        }
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

      console.log('🔄 AuthService: Attempting to upsert user data:', userData);
      
      // שימוש ב-upsert כי ה-trigger כבר יכול ליצור את השורה
      const { data: insertData, error: insertError } = await supabase
        .from('users')
        .upsert(userData, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
        .select();
      
      if (insertError) {
        console.error('❌ AuthService: Error upserting user profile:', insertError);
        console.error('❌ AuthService: Upsert data:', userData);
        console.error('❌ AuthService: Upsert result:', insertData);
        return { user: null, error: `Database error: ${insertError.message}` };
      }
      
      console.log('✅ AuthService: User created successfully:', insertData);
      
      const finalUser = await this.getUserProfile(data.user.id);
      return { user: finalUser, error: null };
    } catch (error: any) {
      console.error('❌ AuthService: Sign up exception:', error);
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
      console.log('🔄 AuthService: Calling supabase.auth.signOut()...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ AuthService: Error signing out:', error);
        return { error: error.message || null };
      }
      console.log('✅ AuthService: Sign out successful');
      return { error: null };
    } catch (error: any) {
      console.error('❌ AuthService: Exception signing out:', error);
      return { error: error.message };
    }
  }

  // Get current user
  static async getCurrentUser(): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return { user: null, error: null };
      const user = await this.getUserProfile(data.user.id);
      return { user, error: null };
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

  // Sign in with Google OAuth using Supabase
  static async signInWithGoogle(): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      console.log('🔄 AuthService: Starting Google OAuth sign in with Supabase...');
      
      // Get the correct redirect URI based on environment
      // In Expo Go: exp://192.168.x.x:port/--/oauth
      // In standalone: com.darkpool.app://oauth
      const redirectUri = AuthSession.makeRedirectUri({
        path: 'oauth',
        // Let Expo detect scheme automatically (exp:// or com.darkpool.app://)
      });
      
      console.log('🔄 AuthService: Redirect URI:', redirectUri);
      
      // Validate redirect URI
      if (!redirectUri || redirectUri.includes('localhost') || redirectUri.includes('127.0.0.1')) {
        console.error('❌ AuthService: Invalid redirect URI:', redirectUri);
        return { user: null, error: 'שגיאה בהגדרת ה-redirect URI. אנא בדוק את ההגדרות.' };
      }

      // Ensure redirect URI is properly formatted
      // Supabase expects the redirect URI to match what's configured in the dashboard
      console.log('🔄 AuthService: Using redirect URI:', redirectUri);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: false,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('❌ AuthService: Supabase OAuth error:', error);
        return { user: null, error: error.message || 'שגיאה בהתחברות עם Google' };
      }

      // Supabase returns a URL that needs to be opened in a browser
      if (data?.url) {
        console.log('✅ AuthService: Opening OAuth URL in browser...');
        console.log('🔄 AuthService: OAuth URL:', data.url);
        console.log('🔄 AuthService: Expected redirect URI:', redirectUri);
        
        // Use openAuthSessionAsync with proper options
        const result = await WebBrowser.openAuthSessionAsync(
          data.url, 
          redirectUri,
          {
            showInRecents: true,
            enableBarCollapsing: false,
          }
        );
        
        console.log('🔄 AuthService: OAuth result:', {
          type: result.type,
          hasUrl: !!(result as any).url,
          url: (result as any).url,
        });

        if (result.type === 'cancel' || result.type === 'dismiss') {
          console.log('❌ AuthService: User cancelled Google OAuth');
          return { user: null, error: 'ההתחברות בוטלה' };
        }

        if (result.type === 'success') {
          const redirectUrl = (result as any).url;
          if (!redirectUrl) {
            console.log('⚠️ AuthService: No redirect URL in result, waiting for session...');
            // Wait a bit for Supabase to process
            await new Promise(resolve => setTimeout(resolve, 2000));
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              const user = await this.getUserProfile(session.user.id);
              return { user, error: null };
            }
            return { user: null, error: 'לא התקבל URL redirect' };
          }
          
          console.log('✅ AuthService: Got redirect URL:', redirectUrl);
          
          // Extract the URL fragment or query params
          try {
            // Handle custom scheme URLs (com.darkpool.app://, exp://)
            const isCustomScheme = redirectUrl.startsWith('com.darkpool.app://') || 
                                   redirectUrl.startsWith('exp://') ||
                                   redirectUrl.startsWith('exps://');
            
            if (isCustomScheme) {
              console.log('🔄 AuthService: Parsing custom scheme URL...');
              // Custom scheme URL - parse manually
              const parts = redirectUrl.split('#');
              if (parts.length > 1) {
                const hash = parts[1];
                const params = new URLSearchParams(hash);
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');
                const error = params.get('error') || params.get('error_description');
                
                if (error) {
                  console.error('❌ AuthService: OAuth error in redirect:', error);
                  return { user: null, error: error || 'שגיאה בהתחברות עם Google' };
                }

                if (accessToken && refreshToken) {
                  console.log('✅ AuthService: Got tokens from redirect, setting session...');
                  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                  });

                  if (sessionError) {
                    console.error('❌ AuthService: Error setting session:', sessionError);
                    return { user: null, error: sessionError.message || 'שגיאה בהתחברות' };
                  }

                  if (sessionData?.user) {
                    console.log('✅ AuthService: Session set successfully, fetching user profile...');
                    const user = await this.getUserProfile(sessionData.user.id);
                    return { user, error: null };
                  }
                }
              }
              // If no hash, wait for session
              console.log('⏳ AuthService: No tokens in URL, waiting for session...');
              await new Promise(resolve => setTimeout(resolve, 2000));
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user) {
                const user = await this.getUserProfile(session.user.id);
                return { user, error: null };
              }
              return { user: null, error: 'לא התקבל token ב-redirect' };
            }
            
            // Standard URL
            const url = new URL(redirectUrl);
            const hash = url.hash.substring(1); // Remove the #
            const params = new URLSearchParams(hash);
            
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const error = params.get('error') || params.get('error_description');
            
            if (error) {
              console.error('❌ AuthService: OAuth error in redirect:', error);
              return { user: null, error: error || 'שגיאה בהתחברות עם Google' };
            }

            if (accessToken && refreshToken) {
              console.log('✅ AuthService: Got tokens, setting session...');
              
              // Set the session with Supabase
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (sessionError) {
                console.error('❌ AuthService: Error setting session:', sessionError);
                return { user: null, error: sessionError.message || 'שגיאה בהתחברות' };
              }

              if (sessionData?.user) {
                console.log('✅ AuthService: Session set successfully, fetching user profile...');
                const user = await this.getUserProfile(sessionData.user.id);
                return { user, error: null };
              }
            } else {
              // Try to get code from query params
              const code = url.searchParams.get('code');
              if (code) {
                console.log('✅ AuthService: Got authorization code, waiting for session...');
                // Wait a bit for Supabase to process the code
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Check if session was created
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                  const user = await this.getUserProfile(session.user.id);
                  return { user, error: null };
                }
              }
            }
          } catch (urlError: any) {
            console.error('❌ AuthService: Error parsing redirect URL:', urlError);
            // Try to continue anyway - Supabase might have processed it
            await new Promise(resolve => setTimeout(resolve, 2000));
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              const user = await this.getUserProfile(session.user.id);
              return { user, error: null };
            }
          }
        }
      }

      // The OAuth flow will redirect to our app, and the auth state change listener
      // will handle updating the user. We return success here.
      console.log('✅ AuthService: OAuth flow initiated successfully');
      console.log('🔄 AuthService: Waiting for OAuth redirect...');
      
      // Note: The user will be set automatically by the auth state change listener
      // when the OAuth flow completes and redirects back to the app
      return { user: null, error: null };
    } catch (error: any) {
      console.error('❌ AuthService: Google OAuth exception:', error);
      return { user: null, error: error.message || 'שגיאה בהתחברות עם Google' };
    }
  }

  // Listen to auth state changes
  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 AuthService: Auth state change event:', event, 'hasSession:', !!session, 'hasUser:', !!session?.user);
      
      // אם זה SIGNED_OUT event, תמיד נקרא callback(null)
      if (event === 'SIGNED_OUT') {
        console.log('🔄 AuthService: SIGNED_OUT event, calling callback with null');
        callback(null);
        return;
      }
      
      if (session?.user) {
        try {
          console.log('🔄 AuthService: Getting user profile for:', session.user.id);
          const user = await this.getUserProfile(session.user.id);
          if (user) {
            console.log('✅ AuthService: User profile loaded successfully:', user.id);
            callback(user);
          } else {
            // אם getUserProfile מחזיר null, זה יכול להיות בעיית רשת או שהמשתמש לא קיים
            // ב-INITIAL_SESSION, לא נקרא callback(null) כי זה יכול להיות בעיית רשת
            if (event === 'INITIAL_SESSION') {
              console.log('⚠️ AuthService: INITIAL_SESSION - getUserProfile returned null, might be network issue. Not calling callback.');
            } else {
              console.log('🔄 AuthService: getUserProfile returned null, calling callback with null');
              callback(null);
            }
          }
        } catch (error) {
          console.error('❌ AuthService: Error getting user profile:', error);
          // אם יש session אבל getUserProfile נכשל, זה יכול להיות בעיית רשת
          // ב-INITIAL_SESSION, לא נקרא callback(null) כי זה יכול להיות בעיית רשת
          if (event === 'INITIAL_SESSION') {
            console.log('⚠️ AuthService: INITIAL_SESSION - Error getting user profile, might be network issue. Not calling callback.');
          } else {
            console.log('⚠️ AuthService: Error getting user profile, calling callback with null');
            callback(null);
          }
        }
      } else {
        // אם אין session או אין user, נקרא callback(null) רק אם זה לא INITIAL_SESSION
        if (event === 'INITIAL_SESSION') {
          console.log('⚠️ AuthService: INITIAL_SESSION - No session or user, might be network issue. Not calling callback.');
        } else {
          console.log('🔄 AuthService: No session or user, calling callback with null');
          callback(null);
        }
      }
    });
  }
} 