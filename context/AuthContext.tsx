import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthService, AuthUser, LoginCredentials, RegisterCredentials } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationService } from '../services/notificationService';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (credentials: LoginCredentials) => Promise<{ error: string | null }>;
  signUp: (credentials: RegisterCredentials) => Promise<{ error: string | null }>;
  signOut: (keepCredentials?: boolean) => Promise<{ error: string | null }>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<{ error: string | null }>;
  setUser: (user: AuthUser | null) => void;
  attemptAutoLogin: () => Promise<void>;
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

  const initializeAuth = async () => {
    let finalUser = await checkUser();
    console.log('🔍 AuthContext: Current user after checkUser:', finalUser?.id);
    
    // אם אין משתמש מחובר, נבדוק אם המשתמש התנתק במפורש
    if (!finalUser) {
      // בדיקה אם המשתמש התנתק במפורש (לא רוצים auto-login אחרי sign out)
      const wasExplicitLogout = await AsyncStorage.getItem('explicit_logout');
      
      if (wasExplicitLogout === 'true') {
        console.log('🔄 AuthContext: Explicit logout detected, skipping auto-login');
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
        setIsLoading(false);
        return;
      } else {
        console.log('🔄 AuthContext: No current user, attempting auto-login...');
        finalUser = await attemptAutoLogin();
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
      
      // אפס את ה-flag של רישום token
      deviceTokenRegisteredRef.current = false;
      
      // עדכון ה-user state מיד כדי שהניווט יתבצע מיד
      setUser(null);
      setIsLoading(false);
      
      // ביטול device token לפני התנתקות
      try {
        console.log('📱 AuthContext: Unregistering device token...');
        await NotificationService.unregisterDeviceToken();
        console.log('✅ AuthContext: Device token unregistered');
      } catch (tokenError) {
        console.error('⚠️ AuthContext: Error unregistering device token (non-critical):', tokenError);
        // לא נכשל אם זה לא עובד - זה לא קריטי
      }
      
      // מחיקת נתוני התחברות שמורים בהתנתקות - תמיד מוחקים כדי למנוע auto-login
      // אם המשתמש רוצה להתחבר שוב, הוא יכול לסמן "זכור אותי" מחדש
      try {
        await AsyncStorage.removeItem('saved_email');
        await AsyncStorage.removeItem('saved_password');
        await AsyncStorage.removeItem('remember_me');
        // סימון שהמשתמש התנתק במפורש כדי למנוע auto-login בריענון
        await AsyncStorage.setItem('explicit_logout', 'true');
        console.log('✅ AuthContext: Cleared saved credentials on logout');
      } catch (storageError) {
        console.error('❌ AuthContext: Error clearing saved credentials:', storageError);
      }
      
      // מחיקת כל ה-device preferences - הם ספציפיים למכשיר ולמשתמש
      // כשמשתמש מתנתק, כל ההגדרות שלו במכשיר הזה נמחקות
      try {
        console.log('🧹 AuthContext: Clearing device preferences...');
        await AsyncStorage.removeItem('appSettings'); // הגדרות אפליקציה (dark mode, language, etc.)
        await AsyncStorage.removeItem('notificationSettings'); // הגדרות התראות
        console.log('✅ AuthContext: Device preferences cleared');
      } catch (prefsError) {
        console.error('⚠️ AuthContext: Error clearing device preferences (non-critical):', prefsError);
        // לא נכשל אם זה לא עובד - זה לא קריטי
      }
      
      // קריאה ל-signOut ב-Supabase (זה יעדכן את ה-onAuthStateChange)
      const { error } = await AuthService.signOut();
      if (error) {
        console.error('❌ AuthContext: Error signing out:', error);
        // גם אם יש שגיאה, המשתמש כבר הוגדר כ-null
        return { error };
      }
      
      console.log('✅ AuthContext: Sign out completed successfully');
      return { error: null };
    } catch (error: any) {
      console.error('❌ AuthContext: Exception in sign out:', error);
      // גם במקרה של שגיאה, ננסה להתנתק
      setUser(null);
      setIsLoading(false);
      // נמחק את הנתונים גם במקרה של שגיאה
      try {
        await AsyncStorage.removeItem('saved_email');
        await AsyncStorage.removeItem('saved_password');
        await AsyncStorage.removeItem('remember_me');
        await AsyncStorage.setItem('explicit_logout', 'true');
        // מחיקת device preferences גם במקרה של שגיאה
        await AsyncStorage.removeItem('appSettings');
        await AsyncStorage.removeItem('notificationSettings');
      } catch (storageError) {
        console.error('❌ AuthContext: Error clearing saved credentials in exception:', storageError);
      }
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