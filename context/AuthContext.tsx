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

  useEffect(() => {
    console.log('🔄 AuthContext: Initializing...');
    initializeAuth();
    const { data: { subscription } } = AuthService.onAuthStateChange(async (user) => {
      console.log('🔄 AuthContext: Auth state changed, user:', user?.id || 'null');
      setUser(user);
      setIsLoading(false);
      
      // רישום device token כשהמשתמש נכנס
      if (user) {
        console.log('📱 AuthContext: Registering device token for user:', user.id);
        // נחכה קצת כדי לוודא שהכל מוכן
        setTimeout(async () => {
          console.log('⏰ AuthContext: Timeout completed, calling registerDeviceToken...');
          const result = await NotificationService.registerDeviceToken();
          console.log('📱 AuthContext: registerDeviceToken result:', result);
        }, 2000);
      } else {
        console.log('🔄 AuthContext: User signed out, state updated to null');
      }
    });
    return () => {
      console.log('🧹 AuthContext: Cleaning up auth state listener');
      subscription.unsubscribe();
    };
  }, []);

  const initializeAuth = async () => {
    console.log('🔄 AuthContext: Initializing...');
    const currentUser = await checkUser();
    console.log('🔍 AuthContext: Current user after checkUser:', currentUser?.id);
    
    // אם אין משתמש מחובר, ננסה התחברות אוטומטית
    if (!currentUser) {
      console.log('🔄 AuthContext: No current user, attempting auto-login...');
      await attemptAutoLogin();
    }
    
    // רישום device token אם יש משתמש מחובר
    if (currentUser) {
      console.log('📱 AuthContext: User found in initializeAuth, registering device token...');
      setTimeout(async () => {
        const result = await NotificationService.registerDeviceToken();
        console.log('📱 AuthContext: registerDeviceToken result (initializeAuth):', result);
      }, 2000);
    }
    
    console.log('✅ AuthContext: Initialization complete, user:', currentUser?.id);
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
        // רישום device token
        setTimeout(async () => {
          console.log('⏰ AuthContext: Timeout completed (checkUser), calling registerDeviceToken...');
          const result = await NotificationService.registerDeviceToken();
          console.log('📱 AuthContext: registerDeviceToken result (checkUser):', result);
        }, 2000);
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

  const attemptAutoLogin = async () => {
    try {
      console.log('🔄 AuthContext: Attempting auto-login...');
      const savedRememberMe = await AsyncStorage.getItem('remember_me');
      const savedEmail = await AsyncStorage.getItem('saved_email');
      const savedPassword = await AsyncStorage.getItem('saved_password');

      if (savedRememberMe === 'true' && savedEmail && savedPassword) {
        console.log('🔄 AuthContext: Found saved credentials, attempting auto-login...');
        const { user, error } = await AuthService.signIn({ email: savedEmail, password: savedPassword });
        if (error) {
          console.log('❌ AuthContext: Auto-login failed:', error);
          // אם ההתחברות האוטומטית נכשלת, נמחק את הנתונים השמורים
          await AsyncStorage.removeItem('saved_email');
          await AsyncStorage.removeItem('saved_password');
          await AsyncStorage.removeItem('remember_me');
        } else if (user) {
          console.log('✅ AuthContext: Auto-login successful');
          setUser(user);
          // רישום device token
          setTimeout(async () => {
            console.log('⏰ AuthContext: Timeout completed (auto-login), calling registerDeviceToken...');
            const result = await NotificationService.registerDeviceToken();
            console.log('📱 AuthContext: registerDeviceToken result (auto-login):', result);
          }, 2000);
        }
      }
    } catch (error) {
      console.error('❌ AuthContext: Error during auto-login:', error);
    }
  };

  const signIn = async (credentials: LoginCredentials): Promise<{ error: string | null }> => {
    console.log('🔄 AuthContext: Signing in user with email:', credentials.email);
    setIsLoading(true);
    try {
      const { user, error } = await AuthService.signIn(credentials);
      if (error) {
        console.error('❌ AuthContext: Sign in error:', error);
        return { error };
      }
      console.log('✅ AuthContext: User signed in successfully:', user?.id);
      setUser(user);
      // רישום device token
      setTimeout(async () => {
        console.log('⏰ AuthContext: Timeout completed (signIn), calling registerDeviceToken...');
        const result = await NotificationService.registerDeviceToken();
        console.log('📱 AuthContext: registerDeviceToken result (signIn):', result);
      }, 2000);
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
      const { user, error } = await AuthService.signUp(credentials);
      if (error) {
        console.error('❌ AuthContext: Sign up error:', error);
        return { error };
      }
      console.log('✅ AuthContext: User signed up successfully:', user?.id);
      setUser(user);
      return { error: null };
    } catch (error: any) {
      console.error('❌ AuthContext: Sign up exception:', error);
      return { error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (keepCredentials: boolean = false): Promise<{ error: string | null }> => {
    setIsLoading(true);
    try {
      console.log('🔄 AuthContext: Starting sign out...');
      
      // ביטול device token לפני התנתקות
      try {
        console.log('📱 AuthContext: Unregistering device token...');
        await NotificationService.unregisterDeviceToken();
        console.log('✅ AuthContext: Device token unregistered');
      } catch (tokenError) {
        console.error('⚠️ AuthContext: Error unregistering device token (non-critical):', tokenError);
        // לא נכשל אם זה לא עובד - זה לא קריטי
      }
      
      // מחיקת נתוני התחברות שמורים בהתנתקות (אלא אם כן המשתמש בחר לשמור)
      if (!keepCredentials) {
        try {
          await AsyncStorage.removeItem('saved_email');
          await AsyncStorage.removeItem('saved_password');
          await AsyncStorage.removeItem('remember_me');
          console.log('✅ AuthContext: Cleared saved credentials on logout');
        } catch (storageError) {
          console.error('❌ AuthContext: Error clearing saved credentials:', storageError);
        }
      } else {
        console.log('✅ AuthContext: Keeping saved credentials as requested');
      }
      
      const { error } = await AuthService.signOut();
      if (error) {
        console.error('❌ AuthContext: Error signing out:', error);
        return { error };
      }
      
      // עדכון ה-user state - ה-onAuthStateChange אמור לטפל בזה, אבל נוסיף fallback
      setUser(null);
      
      // נמתין קצת כדי לוודא שה-onAuthStateChange event נקרא
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('✅ AuthContext: Sign out completed successfully');
      return { error: null };
    } catch (error: any) {
      console.error('❌ AuthContext: Exception in sign out:', error);
      // גם במקרה של שגיאה, ננסה להתנתק
      setUser(null);
      return { error: error.message };
    } finally {
      setIsLoading(false);
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