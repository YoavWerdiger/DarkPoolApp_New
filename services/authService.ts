import { supabase } from './supabase';

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
      
      // אם יש שגיאה ב-auth.signUp, ננסה ליצור משתמש ישירות
      if (error || !data.user) {
        console.log('🔄 AuthService: auth.signUp failed, trying direct user creation...');
        
        // יצירת UUID עבור המשתמש
        const userId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
        console.log('🔄 AuthService: Generated user ID:', userId);
        
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

        console.log('🔄 AuthService: Attempting direct user creation:', userData);
        
        const { data: insertData, error: insertError } = await supabase.from('users').insert(userData).select();
        
        if (insertError) {
          console.error('❌ AuthService: Direct user creation failed:', insertError);
          return { user: null, error: `Database error: ${insertError.message}` };
        }
        
        console.log('✅ AuthService: User created directly:', insertData);
        
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

      console.log('🔄 AuthService: Attempting to insert user data:', userData);
      
      const { data: insertData, error: insertError } = await supabase.from('users').insert(userData).select();
      
      if (insertError) {
        console.error('❌ AuthService: Error creating user profile:', insertError);
        console.error('❌ AuthService: Insert data:', userData);
        console.error('❌ AuthService: Insert result:', insertData);
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
      const { error } = await supabase.auth.signOut();
      return { error: error?.message || null };
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

  // Listen to auth state changes
  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        this.getUserProfile(session.user.id).then(callback);
      } else {
        callback(null);
      }
    });
  }
} 