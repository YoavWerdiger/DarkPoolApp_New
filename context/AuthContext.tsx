import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthService, AuthUser, LoginCredentials, RegisterCredentials } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationService } from '../services/notificationService';
import { supabase } from '../services/supabase';

// תוצאה של התחברות עם Google
interface GoogleSignInResult {
  error: string | null;
  isNewUser?: boolean;
  googleUser?: {
    id: string;
    email: string;
    fullName: string;
    profileImage: string | null;
  };
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (credentials: LoginCredentials) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<GoogleSignInResult>;
  signUp: (credentials: RegisterCredentials) => Promise<{ error: string | null }>;
  signOut: (keepCredentials?: boolean) => Promise<{ error: string | null }>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<{ error: string | null }>;
  setUser: (user: AuthUser | null) => void;
  attemptAutoLogin: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const deviceTokenRegisteredRef = React.useRef(false);

  // פונקציה לרישום device token - תקרא רק פעם אחת
  const registerDeviceTokenOnce = async (userId: string) => {
    if (deviceTokenRegisteredRef.current) {
      console.log('📱 AuthContext: Device token already registered, skipping');
      return;
    }
    deviceTokenRegisteredRef.current = true;
    console.log('📱 AuthContext: Registering device token for user:', userId);
    try {
      const result = await NotificationService.registerDeviceToken();
      console.log('📱 AuthContext: registerDeviceToken result:', result);
    } catch (error) {
      console.error('📱 AuthContext: registerDeviceToken error:', error);
      deviceTokenRegisteredRef.current = false; // אפשר לנסות שוב
    }
  };

  useEffect(() => {
    console.log('🔄 AuthContext: Initializing...');
    initializeAuth();
    const { data: { subscription } } = AuthService.onAuthStateChange(async (authUser) => {
      console.log('🔄 AuthContext: Auth state changed, user:', authUser?.id || 'null');

      // אם יש explicit_logout, לא נעדכן את ה-state בחזרה למשתמש
      if (authUser) {
        const wasExplicitLogout = await AsyncStorage.getItem('explicit_logout');
        if (wasExplicitLogout === 'true') {
          console.log('🔄 AuthContext: Explicit logout detected, ignoring auth state change');
          // נמחק את הפלג הזה כדי לאפשר התחברות חדשה
          await AsyncStorage.removeItem('explicit_logout');
          setUser(null);
          setIsLoading(false);
          deviceTokenRegisteredRef.current = false;
          return;
        }
      }

      setUser(authUser);

      if (!authUser) {
        console.log('🔄 AuthContext: User signed out, state updated to null');
        setIsLoading(false);
        deviceTokenRegisteredRef.current = false; // אפס כשמתנתקים
      }
      // לא קוראים לרישום token כאן - זה יקרא ב-initializeAuth או signIn
    });
    return () => {
      console.log('🧹 AuthContext: Cleaning up auth state listener');
      subscription.unsubscribe();
    };
  }, []);

  // Timeout helper function
  const withTimeout = <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(message));
      }, ms);
      promise.then(
        (res) => {
          clearTimeout(timeoutId);
          resolve(res);
        },
        (err) => {
          clearTimeout(timeoutId);
          reject(err);
        }
      );
    });
  };

  const initializeAuth = async () => {
    // בדיקה ראשונית אם המשתמש התנתק במפורש - לפני כל בדיקה אחרת
    const wasExplicitLogout = await AsyncStorage.getItem('explicit_logout');

    if (wasExplicitLogout === 'true') {
      console.log('🔄 AuthContext: Explicit logout detected, forcing sign out...');

      // אם יש session פעיל, נמחק אותו
      try {
        // use timeout for this too to be safe
        const { data } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null } }>((resolve) => setTimeout(() => resolve({ data: { session: null } }), 1000))
        ]);

        if (data?.session) {
          console.log('🔄 AuthContext: Found active session, signing out...');
          await AuthService.signOut();
        }
      } catch (error) {
        console.error('⚠️ AuthContext: Error checking/signing out session:', error);
      }

      // נמחק את הפלג הזה
      await AsyncStorage.removeItem('explicit_logout');
      // נמחק גם את הנתונים השמורים אם יש - וודא שהם נמחקים
      try {
        await AsyncStorage.removeItem('saved_email');
        await AsyncStorage.removeItem('saved_password');
        await AsyncStorage.removeItem('remember_me');
        console.log('✅ AuthContext: Cleared all saved credentials after explicit logout');
      } catch (error) {
        console.error('❌ AuthContext: Error clearing credentials:', error);
      }

      setUser(null);
      setIsLoading(false);
      return;
    }

    // רק אחרי שבדקנו שאין explicit_logout, נבדוק אם יש משתמש מחובר
    let finalUser = null;

    try {
      // הגנה מפני תקיעה בטעינה - timeout של 7 שניות
      console.log('⏳ AuthContext: Checking user with timeout protection...');
      finalUser = await withTimeout(checkUser(), 7000, 'Auth check timed out');
      console.log('🔍 AuthContext: Current user after checkUser:', finalUser?.id);
    } catch (e) {
      console.error('⚠️ AuthContext: User check timed out or failed:', e);
      // במקרה של תקלה קריטית בטעינה, ננקה את הזיכרון כדי למנוע לופ אינסופי
      console.log('🧹 AuthContext: Clearing session due to timeout to prevent infinite loading...');
      try {
        // ניקוי נתונים בסיסי
        await Promise.all([
          AsyncStorage.removeItem('supabase.auth.token'),
          AsyncStorage.removeItem('saved_email'),
          AsyncStorage.removeItem('saved_password'),
        ]).catch(err => console.warn('Failed to clear some items', err));

        // ננסה גם ניקוי של Supabase internal storage logic אם אפשר
        const allKeys = await AsyncStorage.getAllKeys();
        const supabaseKeys = allKeys.filter(key => key.includes('supabase') || key.includes('sb-'));
        if (supabaseKeys.length > 0) {
          await AsyncStorage.multiRemove(supabaseKeys);
        }
      } catch (clearErr) {
        console.error('❌ AuthContext: Failed to clear storage after timeout:', clearErr);
      }
      finalUser = null;
    }

    // אם אין משתמש מחובר, ננסה auto-login
    if (!finalUser) {
      console.log('🔄 AuthContext: No current user, attempting auto-login...');
      try {
        finalUser = await withTimeout(attemptAutoLogin(), 5000, 'Auto-login timed out');
      } catch (e) {
        console.error('⚠️ AuthContext: Auto-login timed out:', e);
        finalUser = null;
      }
    }

    // רישום device token אם יש משתמש מחובר (ללא delay מיותר)
    if (finalUser) {
      registerDeviceTokenOnce(finalUser.id);
    }

    console.log('✅ AuthContext: Initialization complete, user:', finalUser?.id);
    setIsLoading(false);
  };

  const checkUser = async (): Promise<AuthUser | null> => {
    console.log('🔍 AuthContext: Checking current user...');
    try {
      // בדיקה אם יש משתמש מחובר כרגע
      const { user, error } = await AuthService.getCurrentUser();
      if (user) {
        console.log('✅ AuthContext: Current user loaded:', user?.id);
        setUser(user);
        return user;
      }

      console.log('❌ AuthContext: No current user found');
      setUser(null);
      return null;
    } catch (error) {
      console.error('❌ AuthContext: Error checking user:', error);
      setUser(null);
      return null;
    }
  };

  const attemptAutoLogin = async (): Promise<AuthUser | null> => {
    try {
      console.log('🔄 AuthContext: Attempting auto-login...');
      const savedRememberMe = await AsyncStorage.getItem('remember_me');
      const savedEmail = await AsyncStorage.getItem('saved_email');
      const savedPassword = await AsyncStorage.getItem('saved_password');

      if (savedRememberMe === 'true' && savedEmail && savedPassword) {
        console.log('🔄 AuthContext: Found saved credentials, attempting auto-login...');
        const { user: autoUser, error } = await AuthService.signIn({ email: savedEmail, password: savedPassword });
        if (error) {
          console.log('❌ AuthContext: Auto-login failed:', error);
          // אם ההתחברות האוטומטית נכשלת, נמחק את הנתונים השמורים
          await AsyncStorage.removeItem('saved_email');
          await AsyncStorage.removeItem('saved_password');
          await AsyncStorage.removeItem('remember_me');
          return null;
        } else if (autoUser) {
          console.log('✅ AuthContext: Auto-login successful');
          setUser(autoUser);
          return autoUser;
        }
      }
      return null;
    } catch (error) {
      console.error('❌ AuthContext: Error during auto-login:', error);
      return null;
    }
  };

  const signIn = async (credentials: LoginCredentials): Promise<{ error: string | null }> => {
    console.log('🔄 AuthContext: Signing in user with email:', credentials.email);
    setIsLoading(true);
    deviceTokenRegisteredRef.current = false; // אפס לפני login חדש
    try {
      const { user: signedInUser, error } = await AuthService.signIn(credentials);
      if (error) {
        console.error('❌ AuthContext: Sign in error:', error);
        return { error };
      }
      console.log('✅ AuthContext: User signed in successfully:', signedInUser?.id);
      setUser(signedInUser);
      // רישום device token - ללא delay
      if (signedInUser) {
        registerDeviceTokenOnce(signedInUser.id);
      }
      return { error: null };
    } catch (error: any) {
      console.error('❌ AuthContext: Sign in exception:', error);
      return { error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async (): Promise<GoogleSignInResult> => {
    console.log('🔄 AuthContext: Signing in with Google...');
    setIsLoading(true);
    deviceTokenRegisteredRef.current = false; // אפס לפני login חדש
    try {
      const result = await AuthService.signInWithGoogle();

      if (result.error) {
        console.error('❌ AuthContext: Google sign in error:', result.error);
        return { error: result.error };
      }

      // בדיקה אם המשתמש חדש (אין לו פרופיל מלא)
      if (result.user) {
        // בדיקה אם המשתמש השלים את ההרשמה (יש לו intro_data או נתוני מסחר)
        const isNewUser = !result.user.intro_data || Object.keys(result.user.intro_data || {}).length === 0;

        console.log('✅ AuthContext: Google sign in result:', {
          userId: result.user.id,
          isNewUser,
          hasIntroData: !!result.user.intro_data
        });

        if (isNewUser) {
          // משתמש חדש - לא נשמור אותו עדיין, נחזיר את הנתונים
          console.log('🆕 AuthContext: New Google user detected, returning data for onboarding');
          return {
            error: null,
            isNewUser: true,
            googleUser: {
              id: result.user.id,
              email: result.user.email,
              fullName: result.user.full_name || result.user.display_name || '',
              profileImage: result.user.profile_picture || null
            }
          };
        }

        // משתמש קיים - התחבר רגיל
        console.log('✅ AuthContext: Existing Google user, logging in');
        setUser(result.user);
        registerDeviceTokenOnce(result.user.id);
        return { error: null, isNewUser: false };
      }

      return { error: 'לא התקבלו נתוני משתמש' };
    } catch (error: any) {
      console.error('❌ AuthContext: Google sign in exception:', error);
      return { error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (credentials: RegisterCredentials): Promise<{ error: string | null }> => {
    console.log('🔄 AuthContext: Signing up user with email:', credentials.email);
    setIsLoading(true);
    try {
      // מחיקת כל הנתונים השמורים לפני יצירת משתמש חדש
      // זה מבטיח שלא תהיה התחברות אוטומטית למשתמש אחר
      try {
        await AsyncStorage.removeItem('saved_email');
        await AsyncStorage.removeItem('saved_password');
        await AsyncStorage.removeItem('remember_me');
        await AsyncStorage.setItem('explicit_logout', 'true');
        console.log('✅ AuthContext: Cleared all saved credentials before sign up');
      } catch (storageError) {
        console.error('❌ AuthContext: Error clearing saved credentials:', storageError);
      }

      // אם יש משתמש מחובר, נתנתק קודם
      if (user) {
        console.log('🔄 AuthContext: User already logged in, signing out first...');
        // התנתקות ישירה דרך AuthService (לא דרך signOut כדי למנוע בעיות)
        try {
          setUser(null);
          await AuthService.signOut();
          console.log('✅ AuthContext: Signed out existing user');
        } catch (signOutError) {
          console.error('⚠️ AuthContext: Error signing out existing user (non-critical):', signOutError);
          // לא נכשל אם זה לא עובד - נמשיך עם יצירת המשתמש החדש
        }
      }

      const { user: newUser, error } = await AuthService.signUp(credentials);
      if (error) {
        console.error('❌ AuthContext: Sign up error:', error);
        return { error };
      }
      console.log('✅ AuthContext: User signed up successfully:', newUser?.id);
      setUser(newUser);

      // מחיקת explicit_logout כדי לאפשר התחברות אוטומטית למשתמש החדש (אם יסומן "זכור אותי")
      try {
        await AsyncStorage.removeItem('explicit_logout');
        console.log('✅ AuthContext: Removed explicit_logout flag for new user');
      } catch (error) {
        console.error('❌ AuthContext: Error removing explicit_logout:', error);
      }

      return { error: null };
    } catch (error: any) {
      console.error('❌ AuthContext: Sign up exception:', error);
      return { error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (keepCredentials: boolean = false): Promise<{ error: string | null }> => {
    try {
      console.log('🔄 AuthContext: Starting sign out...');

      // שמירת userId לפני שמעדכנים את ה-state
      const currentUserId = user?.id;

      // אפס את ה-flag של רישום token
      deviceTokenRegisteredRef.current = false;

      // עדכון ה-user state מיד בהתחלה - זה יגרום לניווט לדף ההתחברות
      // חשוב לעשות את זה לפני כל פעולה אסינכרונית אחרת!
      console.log('🔄 AuthContext: Setting user to null immediately...');
      setUser(null);
      setIsLoading(false);

      // סימון מיידי שהמשתמש התנתק - זה הכי חשוב כדי למנוע auto-login אחרי reload
      try {
        console.log('🚫 AuthContext: Setting explicit_logout flag immediately...');
        await AsyncStorage.setItem('explicit_logout', 'true');
      } catch (e) {
        console.warn('⚠️ Failed to set explicit_logout:', e);
      }

      // ביטול device token ברקע - לא מחכים לתוצאה
      if (currentUserId) {
        NotificationService.unregisterDeviceToken(currentUserId)
          .then(() => console.log('✅ AuthContext: Device token unregistered'))
          .catch((err) => console.warn('⚠️ AuthContext: Error unregistering device token:', err));
      }

      // קריאה ל-signOut ב-Supabase וניקוי storage במקביל
      console.log('🔄 AuthContext: Calling AuthService.signOut() and clearing storage...');

      // עושים את כל הפעולות במקביל
      await Promise.all([
        AuthService.signOut().catch(err => console.warn('⚠️ Supabase signOut error:', err)),

        // מחיקת נתוני התחברות שמורים
        AsyncStorage.removeItem('saved_email').catch(() => { }),
        AsyncStorage.removeItem('saved_password').catch(() => { }),
        AsyncStorage.removeItem('remember_me').catch(() => { }),
        AsyncStorage.removeItem('appSettings').catch(() => { }),
        AsyncStorage.removeItem('notificationSettings').catch(() => { }),
      ]);

      // מחיקת ה-session של Supabase ישירות מ-AsyncStorage
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const supabaseKeys = allKeys.filter(key =>
          key.includes('supabase') ||
          key.includes('sb-') ||
          key.includes('auth-token')
        );
        if (supabaseKeys.length > 0) {
          await AsyncStorage.multiRemove(supabaseKeys);
          console.log('✅ AuthContext: Cleared Supabase session keys:', supabaseKeys);
        }
      } catch (storageError) {
        console.warn('⚠️ AuthContext: Error clearing Supabase storage:', storageError);
      }

      console.log('✅ AuthContext: All stored data cleared');

      console.log('✅ AuthContext: Sign out completed successfully');
      return { error: null };
    } catch (error: any) {
      console.error('❌ AuthContext: Exception in sign out:', error);

      // וודא שה-UI מעודכן גם במקרה של שגיאה
      setUser(null);
      setIsLoading(false);

      // סימון explicit_logout במקרה של שגיאה
      AsyncStorage.setItem('explicit_logout', 'true').catch(() => { });

      // ניקוי ברקע - לא מחכים
      Promise.all([
        AsyncStorage.removeItem('saved_email'),
        AsyncStorage.removeItem('saved_password'),
        AsyncStorage.removeItem('remember_me'),
        AsyncStorage.removeItem('appSettings'),
        AsyncStorage.removeItem('notificationSettings'),
      ]).catch(() => { });

      // ניקוי Supabase session ברקע
      AsyncStorage.getAllKeys().then(allKeys => {
        const supabaseKeys = allKeys.filter(key =>
          key.includes('supabase') || key.includes('sb-') || key.includes('auth-token')
        );
        if (supabaseKeys.length > 0) {
          AsyncStorage.multiRemove(supabaseKeys).catch(() => { });
        }
      }).catch(() => { });

      return { error: error.message };
    }
  };

  const updateProfile = async (updates: Partial<AuthUser>): Promise<{ error: string | null }> => {
    try {
      const { user, error } = await AuthService.updateProfile(updates);
      if (error) return { error };
      if (user) setUser(user);
      return { error: null };
    } catch (error: any) {
      return { error: error.message };
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    updateProfile,
    setUser,
    attemptAutoLogin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 