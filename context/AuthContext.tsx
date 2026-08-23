import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import {
  AuthService,
  AuthUser,
  LoginCredentials,
  RegisterCredentials,
  mapProfileUpdateError,
} from '../services/authService';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationService } from '../services/notificationService';
import { logger } from '../utils/logger';
import { setUser as setSentryUser, clearUser as clearSentryUser } from '../utils/sentry';
import { clearChatMessagesCache } from '../lib/chatMessagePersist';
import { clearMediaFileCache } from '../lib/mediaFileCache';
import { clearPersistedQueryCache } from '../lib/queryPersist';
import { queryClient } from '../lib/queryClient';
import { clearAllDrafts } from '../services/chat/chatDrafts';
import { clear as clearChatOfflineQueue } from '../services/chat/chatOfflineQueue';
import { clearAllColmexLocal } from '../services/colmex/colmexCredentials';

/** שורד remount / Fast Refresh — מנוקה רק אחרי סיסמה חדשה, signIn רגיל, או signOut */
export const PASSWORD_RECOVERY_PENDING_KEY = 'password_recovery_pending';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  /** אחרי אימות OTP/קישור איפוס — נשארים ב-Auth עד שמירת סיסמה חדשה */
  passwordRecoveryMode: boolean;
  setPasswordRecoveryMode: (value: boolean) => Promise<void>;
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

async function writeRecoveryPending(value: boolean): Promise<void> {
  try {
    if (value) {
      await AsyncStorage.setItem(PASSWORD_RECOVERY_PENDING_KEY, '1');
    } else {
      await AsyncStorage.removeItem(PASSWORD_RECOVERY_PENDING_KEY);
    }
  } catch (e) {
    logger.warn('AuthContext', 'Failed to persist password recovery flag', e);
  }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [passwordRecoveryMode, setPasswordRecoveryModeState] = useState(false);

  const deviceTokenRegistered = React.useRef(false);
  /** מונע שחזור סשן בזמן התנתקות מכוונת */
  const signingOutRef = useRef(false);
  /** קריאה סינכרונית לפני רינדור — מונע קפיצה ל-Main באמצע recovery */
  const passwordRecoveryModeRef = useRef(false);

  const setPasswordRecoveryMode = useCallback(async (value: boolean) => {
    // state סינכרוני קודם — אל תחסום UI על AsyncStorage תקוע
    passwordRecoveryModeRef.current = value;
    setPasswordRecoveryModeState(value);
    try {
      await Promise.race([
        writeRecoveryPending(value),
        new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
      ]);
    } catch (e) {
      logger.warn('AuthContext', 'persist password recovery flag failed', e);
    }
  }, []);

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

  const checkUser = useCallback(async (): Promise<AuthUser | null> => {
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
  }, []);

  const initializeAuth = useCallback(async () => {
    try {
      const currentUser = await checkUser();
      if (currentUser) {
        setTimeout(() => registerTokenOnce(), 2000);
      }
    } catch (error) {
      logger.error('AuthContext', 'Error in initializeAuth', error);
    }
    // isLoading נסגר רק אחרי אירוע onAuthStateChange הראשון — מונע הבהוב מסך התחברות
  }, [checkUser, registerTokenOnce]);

  useEffect(() => {
    logger.debug('AuthContext', 'Initializing');

    const timeoutId = setTimeout(() => {
      setIsLoading(false);
    }, 15000);

    let subscription: { unsubscribe: () => void } | null = null;

    (async () => {
      // חובה לפני initializeAuth / INITIAL_SESSION — אחרת סשן recovery נחשב login רגיל
      try {
        const pending = await AsyncStorage.getItem(PASSWORD_RECOVERY_PENDING_KEY);
        if (pending === '1') {
          passwordRecoveryModeRef.current = true;
          setPasswordRecoveryModeState(true);
          logger.debug('AuthContext', 'Restored password recovery pending flag');
        }
      } catch (e) {
        logger.warn('AuthContext', 'Failed to read password recovery flag', e);
      }

      await initializeAuth();
      const { data } = AuthService.onAuthStateChange((nextUser, event) => {
        // לא async כאן: AuthService כבר דוחה עבודת supabase אחרי שחרור GoTrue lock.
        // getSession/getUser בתוך callback שעדיין תחת updateUser = deadlock.
        logger.debug('AuthContext', 'Auth state changed', event);

        const apply = (resolved: AuthUser | null) => {
          if (signingOutRef.current) {
            if (resolved) {
              logger.debug('AuthContext', 'Ignoring auth restore during signOut', event);
            }
            setUser(null);
            // לא מנקים כאן את דגל ה-recovery — רק setPasswordRecoveryMode(false) / signIn.
            // אחרת signOut טכני באמצע completePasswordRecovery מפיל את הדגל
            // ואז verify-signIn קופץ ל-Main בלי סיסמה שנשמרה.
            setIsLoading(false);
            clearSentryUser();
            deviceTokenRegistered.current = false;
            return;
          }

          // OTP recovery / deep-link — לפני setUser כדי ש-registrationDone יישאר false.
          // verifyOtp(type:recovery) לעיתים יורה SIGNED_IN ולא PASSWORD_RECOVERY —
          // לכן רק אם כבר סומן recovery (ref / AsyncStorage), מחזקים לפני setUser.
          if (event === 'PASSWORD_RECOVERY') {
            passwordRecoveryModeRef.current = true;
            setPasswordRecoveryModeState(true);
            void writeRecoveryPending(true);
          } else if (resolved && passwordRecoveryModeRef.current) {
            setPasswordRecoveryModeState(true);
          }

          // TOKEN_REFRESHED / USER_UPDATED לעיתים שולחים אובייקט חדש עם אותו id —
          // setUser מיותר גורם לרינדור מחדש של כל האפליקציה + לולאות loadGroups בצ'אט.
          setUser((prev) => {
            if (!resolved) return null;
            if (
              prev &&
              prev.id === resolved.id &&
              prev.email === resolved.email &&
              prev.display_name === resolved.display_name &&
              prev.profile_picture === resolved.profile_picture &&
              prev.registration_completed === resolved.registration_completed
            ) {
              return prev;
            }
            return resolved;
          });
          setIsLoading(false);

          if (resolved) {
            setSentryUser(resolved.id, resolved.email);
            setTimeout(() => registerTokenOnce(), 2000);
          } else {
            clearSentryUser();
            deviceTokenRegistered.current = false;
            // SIGNED_OUT באמצע איפוס (verify round-trip) לא אמור למחוק את דגל ה-recovery.
            // ניקוי מפורש רק ב-setPasswordRecoveryMode(false) / signIn / AuthContext.signOut.
            if (event === 'INITIAL_SESSION' && !passwordRecoveryModeRef.current) {
              void writeRecoveryPending(false);
            }
          }
        };

        // שחזור רק ב-INITIAL_SESSION (מרוץ Android) — מחוץ ל-GoTrue callback await
        if (!nextUser && event === 'INITIAL_SESSION') {
          void (async () => {
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData.session?.user) {
                const { user: recovered } = await AuthService.getCurrentUser();
                if (recovered) {
                  apply(recovered);
                  return;
                }
              }
            } catch (e) {
              logger.warn('AuthContext', 'INITIAL_SESSION session recover failed', e);
            }
            apply(null);
          })();
          return;
        }

        apply(nextUser ?? null);
      });
      subscription = data.subscription;
    })();

    return () => {
      clearTimeout(timeoutId);
      subscription?.unsubscribe();
    };
  }, [initializeAuth, registerTokenOnce]);

  const attemptAutoLogin = async () => {
    // Supabase persistSession: true handles session renewal automatically.
    // No need to store or re-use credentials.
  };

  const signIn = async (credentials: LoginCredentials): Promise<{ error: string | null }> => {
    setIsLoading(true);
    try {
      // לפני signInWithPassword — כדי ש-SIGNED_IN לא ישאיר recovery תקוע ויחסום Main
      await setPasswordRecoveryMode(false);

      const { user, error } = await AuthService.signIn(credentials);
      if (error) return { error };
      // מחזקים ניקוי אחרי הצלחה (מרוץ מול onAuthStateChange)
      await setPasswordRecoveryMode(false);
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
    signingOutRef.current = true;
    const previousUserId = user?.id;
    logger.debug('AuthContext', 'signOut called', { previousUserId, keepCredentials });
    try {
      // קודם מנקים UI state — מונע Main / ספינר איפוס סיסמה גם אם scrub נתקע
      setUser(null);
      passwordRecoveryModeRef.current = false;
      setPasswordRecoveryModeState(false);
      void writeRecoveryPending(false);
      setIsLoading(false);
      clearSentryUser();
      deviceTokenRegistered.current = false;

      // scrub סשן עם תקציב זמן — לא חוסמים את הקורא לנצח
      let error: string | null = null;
      try {
        const scrubbed = await Promise.race([
          AuthService.signOut(),
          new Promise<{ error: string }>((resolve) =>
            setTimeout(() => resolve({ error: 'timeout:signOut' }), 12_000)
          ),
        ]);
        error = scrubbed.error;
        if (error === 'timeout:signOut') {
          logger.warn('AuthContext', 'AuthService.signOut timed out — UI already cleared');
          error = null;
        }
      } catch (e) {
        logger.warn('AuthContext', 'AuthService.signOut threw', e);
        void AuthService.signOut().catch(() => { /* ignore */ });
      }
      logger.debug('AuthContext', 'signOut session scrub complete', { error: error ?? null });

      // ניקויי cache לא קריטיים — ברקע, בלי לחסום את הקורא (איפוס סיסמה / logout)
      void (async () => {
        if (previousUserId) {
          try {
            await clearChatMessagesCache(previousUserId);
          } catch (_) { /* non-critical */ }
        }
        try {
          await clearMediaFileCache();
        } catch (_) { /* non-critical */ }
        try {
          await clearPersistedQueryCache();
        } catch (_) { /* non-critical */ }
        try {
          queryClient.clear();
        } catch (_) { /* non-critical */ }
        try {
          await clearAllDrafts();
        } catch (_) { /* non-critical */ }
        try {
          await clearChatOfflineQueue();
        } catch (_) { /* non-critical */ }
        try {
          await clearAllColmexLocal();
        } catch (_) { /* non-critical */ }
        try {
          await NotificationService.unregisterDeviceToken();
        } catch (_) { /* non-critical */ }
      })();

      if (!keepCredentials) {
        try {
          await Promise.race([
            AsyncStorage.multiRemove(['saved_email', 'saved_password', 'remember_me']),
            new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
          ]);
        } catch (_) { /* non-critical */ }
      }

      if (error) return { error };
      return { error: null };
    } catch (error: any) {
      logger.error('AuthContext', 'Exception in sign out', error);
      void AuthService.signOut().catch(() => { /* ignore */ });
      setUser(null);
      setIsLoading(false);
      clearSentryUser();
      deviceTokenRegistered.current = false;
      passwordRecoveryModeRef.current = false;
      setPasswordRecoveryModeState(false);
      void writeRecoveryPending(false);
      return { error: error.message };
    } finally {
      // חלון ארוך יותר — מונע USER_UPDATED מאוחר מ-updateUser שמחזיר user אחרי איפוס
      setTimeout(() => {
        signingOutRef.current = false;
      }, 4000);
    }
  };

  const updateProfile = async (updates: Partial<AuthUser>): Promise<{ error: string | null }> => {
    try {
      const { user, error } = await AuthService.updateProfile(updates);
      if (error) return { error: mapProfileUpdateError(error) };
      if (user) setUser(user);
      return { error: null };
    } catch (error: unknown) {
      return { error: mapProfileUpdateError(error) };
    }
  };

  const signInWithGoogle = async (): Promise<{
    error: string | null;
    isNewUser?: boolean;
    googleUser?: { id: string; email: string; fullName: string; profileImage: string | null };
  }> => {
    setIsLoading(true);
    try {
      await setPasswordRecoveryMode(false);
      const result = await AuthService.signInWithGoogle();
      if (result.error) return { error: result.error };
      if (result.user && !result.isNewUser) {
        await setPasswordRecoveryMode(false);
        setUser(result.user);
        setTimeout(() => registerTokenOnce(), 2000);
      }
      return {
        error: null,
        isNewUser: result.isNewUser,
        googleUser: result.googleUser,
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
    passwordRecoveryMode,
    setPasswordRecoveryMode,
    signIn,
    signUp,
    signOut,
    updateProfile,
    setUser,
    attemptAutoLogin,
    signInWithGoogle,
  }), [user, isLoading, passwordRecoveryMode, setPasswordRecoveryMode]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
