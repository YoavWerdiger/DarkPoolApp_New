import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthService, AuthUser, LoginCredentials, RegisterCredentials } from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (credentials: LoginCredentials) => Promise<{ error: string | null }>;
  signUp: (credentials: RegisterCredentials) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<{ error: string | null }>;
  setUser: (user: AuthUser | null) => void;
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
    checkUser();
    const { data: { subscription } } = AuthService.onAuthStateChange((user) => {
      console.log('🔄 AuthContext: Auth state changed, user:', user?.id);
      setUser(user);
      setIsLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    console.log('🔍 AuthContext: Checking current user...');
    setIsLoading(true);
    try {
      const { user, error } = await AuthService.getCurrentUser();
      if (error) {
        console.error('❌ AuthContext: Error checking user:', error);
      }
      console.log('✅ AuthContext: Current user loaded:', user?.id);
      setUser(user);
    } catch (error) {
      console.error('❌ AuthContext: Error checking user:', error);
    } finally {
      setIsLoading(false);
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

  const signOut = async (): Promise<{ error: string | null }> => {
    setIsLoading(true);
    try {
      const { error } = await AuthService.signOut();
      if (error) return { error };
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 