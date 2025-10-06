import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthService, AuthUser, LoginCredentials, RegisterCredentials } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    const { data: { subscription } } = AuthService.onAuthStateChange((user) => {
      console.log('🔄 AuthContext: Auth state changed, user:', user?.id);
      setUser(user);
      setIsLoading(false);
    });
    return () => subscription.unsubscribe();
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
    
    console.log('✅ AuthContext: Initialization complete, user:', user?.id);
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
      const { error } = await AuthService.signOut();
      if (error) return { error };
      
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
      
      setUser(null);
      return { error: null };
    } catch (error: any) {
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