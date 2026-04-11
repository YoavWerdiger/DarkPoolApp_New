import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { AuthService, AuthUser, LoginCredentials, RegisterCredentials } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationService } from '../services/notificationService';
import { logger } from '../utils/logger';
import { setUser as setSentryUser, clearUser as clearSentryUser } from '../utils/sentry';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (credentials: LoginCredentials) => Promise<{ error: string | null }>;
  signUp: (credentials: RegisterCredentials) => Promise<{ error: string | null }>;
  signOut: (keepCredentials?: boolean) => Promise<{ error: string | null }>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<{ error: string | null }>;
  setUser: (user: AuthUser | null) => void;
  attemptAutoLogin: () => Promise<void>;
  signInWithGoogle: () => Promise<{ 
    error: string | null;
    isNewUser?: boolean;
    googleUser?: { id: string; email: string; fullName: string; profileImage: string | null };
  }>;
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

  const deviceTokenRegistered = React.useRef(false);

  const registerTokenOnce = useCallback(async () => {
    if (deviceTokenRegistered.current) return;
    deviceTokenRegistered.current = true;
    try {
      await NotificationService.registerDeviceToken();
    } catch (e) {
      logger.warn('AuthContext', 'Failed to register device token');
      deviceTokenRegistered.current = false;
    }
  }, []);

  useEffect(() => {
    logger.debug('AuthContext', 'Initializing');

    const timeoutId = setTimeout(() => {
      setIsLoading(false);
    }, 10000);

    initializeAuth();
    const { data: { subscription } } = AuthService.onAuthStateChange(async (user) => {
      logger.debug('AuthContext', 'Auth state changed');
      setUser(user);
      setIsLoading(false);

      if (user) {
        setSentryUser(user.id, user.email);
        setTimeout(() => registerTokenOnce(), 2000);
      } else {
        clearSentryUser();
        deviceTokenRegistered.current = false;
      }
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const initializeAuth = async () => {
    try {
      const checkUserPromise = checkUser();
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 5000);
      });

      const currentUser = await Promise.race([checkUserPromise, timeoutPromise]);

      if (currentUser) {
        setTimeout(() => registerTokenOnce(), 2000);
      }
    } catch (error) {
      logger.error('AuthContext', 'Error in initializeAuth', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkUser = async (): Promise<AuthUser | null> => {
    try {
      const { user } = await AuthService.getCurrentUser();
      if (user) {
        setUser(user);
        return user;
      }
      setUser(null);
      return null;
    } catch (error) {
      logger.error('AuthContext', 'Error checking user', error);
      setUser(null);
      return null;
    }
  };

  const attemptAutoLogin = async () => {
    // Supabase persistSession: true handles session renewal automatically.
    // No need to store or re-use credentials.
  };

  const signIn = async (credentials: LoginCredentials): Promise<{ error: string | null }> => {
    setIsLoading(true);
    try {
      const { user, error } = await AuthService.signIn(credentials);
      if (error) return { error };
      setUser(user);
      setTimeout(() => registerTokenOnce(), 2000);
      return { error: null };
    } catch (error: any) {
      logger.error('AuthContext', 'Sign in exception', error);
      return { error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (credentials: RegisterCredentials): Promise<{ error: string | null }> => {
    setIsLoading(true);
    try {
      const { user, error } = await AuthService.signUp(credentials);
      if (error) return { error };
      setUser(user);
      return { error: null };
    } catch (error: any) {
      logger.error('AuthContext', 'Sign up exception', error);
      return { error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (keepCredentials: boolean = false): Promise<{ error: string | null }> => {
    try {
      setUser(null);
      setIsLoading(false);
      deviceTokenRegistered.current = false;

      try {
        await NotificationService.unregisterDeviceToken();
      } catch (_) { /* non-critical */ }
      
      // Clean up any legacy stored credentials (security hardening)
      try {
        await AsyncStorage.multiRemove(['saved_email', 'saved_password', 'remember_me']);
      } catch (_) { /* non-critical */ }
      
      const { error } = await AuthService.signOut();
      if (error) return { error };
      return { error: null };
    } catch (error: any) {
      logger.error('AuthContext', 'Exception in sign out', error);
      setUser(null);
      setIsLoading(false);
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

  const signInWithGoogle = async (): Promise<{ 
    error: string | null;
    isNewUser?: boolean;
    googleUser?: { id: string; email: string; fullName: string; profileImage: string | null };
  }> => {
    setIsLoading(true);
    try {
      const result = await AuthService.signInWithGoogle();
      if (result.error) return { error: result.error };
      if (result.user) {
        setUser(result.user);
        setTimeout(() => registerTokenOnce(), 2000);
      }
      return { 
        error: null, 
        isNewUser: result.isNewUser, 
        googleUser: result.googleUser 
      };
    } catch (error: any) {
      logger.error('AuthContext', 'Google sign in exception', error);
      return { error: error.message || 'שגיאה בהתחברות עם Google' };
    } finally {
      setIsLoading(false);
    }
  };

  const value = useMemo<AuthContextType>(() => ({
    user,
    isLoading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    setUser,
    attemptAutoLogin,
    signInWithGoogle,
  }), [user, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 