import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage Keys
const STORAGE_KEYS = {
  ONBOARDING_STATE: '@darkpool/onboarding_state',
  ONBOARDING_COMPLETED: '@darkpool/onboarding_completed',
  ONBOARDING_STEP: '@darkpool/onboarding_current_step',
} as const;

// Types
export type InvestorType = 'retail' | 'institutional';
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

export interface OnboardingData {
  // User Identity
  phone: string;
  phoneVerified: boolean;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null; // ISO string
  
  // Investor Profile
  investorType: InvestorType | null;
  riskTolerance: RiskTolerance | null;
  interests: string[];
  
  // Settings
  notificationsEnabled: boolean;
  securityPinEnabled: boolean;
  securityPin?: string; // Hashed
  
  // Flow State
  currentStep: number;
  completedSteps: number[];
  onboardingCompleted: boolean;
  
  // Timestamps
  startedAt: number;
  completedAt?: number;
}

interface OnboardingContextValue {
  data: OnboardingData;
  setPhone: (phone: string) => void;
  setPhoneVerified: (verified: boolean) => void;
  setName: (firstName: string, lastName: string) => void;
  setDateOfBirth: (date: string) => void;
  setInvestorType: (type: InvestorType) => void;
  setRiskTolerance: (tolerance: RiskTolerance) => void;
  toggleInterest: (interest: string) => void;
  setInterests: (interests: string[]) => void;
  setNotifications: (enabled: boolean) => void;
  setSecurityPin: (enabled: boolean, pin?: string) => void;
  setCurrentStep: (step: number) => void;
  markStepCompleted: (step: number) => void;
  completeOnboarding: () => void;
  reset: () => void;
  saveToStorage: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

// Default State
const getDefaultData = (): OnboardingData => ({
  phone: '',
  phoneVerified: false,
  firstName: '',
  lastName: '',
  dateOfBirth: null,
  investorType: null,
  riskTolerance: null,
  interests: [],
  notificationsEnabled: false,
  securityPinEnabled: false,
  currentStep: 1,
  completedSteps: [],
  onboardingCompleted: false,
  startedAt: Date.now(),
});

// Context
const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

// Provider
export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [data, setData] = useState<OnboardingData>(getDefaultData());

  // Load from storage on mount
  useEffect(() => {
    void loadFromStorage();
  }, []);

  // Save to storage whenever data changes
  useEffect(() => {
    void saveToStorage();
  }, [data]);

  const setPhone = (phone: string) => {
    setData((prev) => ({ ...prev, phone }));
  };

  const setPhoneVerified = (verified: boolean) => {
    setData((prev) => ({ ...prev, phoneVerified: verified }));
  };

  const setName = (firstName: string, lastName: string) => {
    setData((prev) => ({ ...prev, firstName, lastName }));
  };

  const setDateOfBirth = (date: string) => {
    setData((prev) => ({ ...prev, dateOfBirth: date }));
  };

  const setInvestorType = (type: InvestorType) => {
    setData((prev) => ({ ...prev, investorType: type }));
  };

  const setRiskTolerance = (tolerance: RiskTolerance) => {
    setData((prev) => ({ ...prev, riskTolerance: tolerance }));
  };

  const toggleInterest = (interest: string) => {
    setData((prev) => {
      const interests = prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest];
      return { ...prev, interests };
    });
  };

  const setInterests = (interests: string[]) => {
    setData((prev) => ({ ...prev, interests }));
  };

  const setNotifications = (enabled: boolean) => {
    setData((prev) => ({ ...prev, notificationsEnabled: enabled }));
  };

  const setSecurityPin = (enabled: boolean, pin?: string) => {
    setData((prev) => ({ 
      ...prev, 
      securityPinEnabled: enabled,
      securityPin: pin,
    }));
  };

  const setCurrentStep = (step: number) => {
    setData((prev) => ({ ...prev, currentStep: step }));
  };

  const markStepCompleted = (step: number) => {
    setData((prev) => {
      if (prev.completedSteps.includes(step)) {
        return prev;
      }
      return {
        ...prev,
        completedSteps: [...prev.completedSteps, step],
      };
    });
  };

  const completeOnboarding = () => {
    setData((prev) => ({
      ...prev,
      onboardingCompleted: true,
      completedAt: Date.now(),
    }));
  };

  const reset = () => {
    setData(getDefaultData());
    void AsyncStorage.multiRemove([
      STORAGE_KEYS.ONBOARDING_STATE,
      STORAGE_KEYS.ONBOARDING_COMPLETED,
      STORAGE_KEYS.ONBOARDING_STEP,
    ]);
  };

  const saveToStorage = async () => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.ONBOARDING_STATE,
        JSON.stringify(data)
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.ONBOARDING_COMPLETED,
        JSON.stringify(data.onboardingCompleted)
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.ONBOARDING_STEP,
        JSON.stringify(data.currentStep)
      );
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  };

  const loadFromStorage = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_STATE);
      if (saved) {
        const parsed = JSON.parse(saved);
        setData(parsed);
      }
    } catch (error) {
      console.error('Failed to load onboarding state:', error);
    }
  };

  const value: OnboardingContextValue = {
    data,
    setPhone,
    setPhoneVerified,
    setName,
    setDateOfBirth,
    setInvestorType,
    setRiskTolerance,
    toggleInterest,
    setInterests,
    setNotifications,
    setSecurityPin,
    setCurrentStep,
    markStepCompleted,
    completeOnboarding,
    reset,
    saveToStorage,
    loadFromStorage,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

// Helper Functions

/**
 * בדיקה אם המשתמש סיים onboarding
 */
export const checkOnboardingCompleted = async (): Promise<boolean> => {
  try {
    const completed = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
    return completed === 'true';
  } catch {
    return false;
  }
};

/**
 * קבלת השלב הנוכחי
 */
export const getCurrentOnboardingStep = async (): Promise<number> => {
  try {
    const step = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_STEP);
    return step ? parseInt(step, 10) : 1;
  } catch {
    return 1;
  }
};

/**
 * איפוס onboarding (לבדיקות)
 */
export const resetOnboarding = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ONBOARDING_STATE,
      STORAGE_KEYS.ONBOARDING_COMPLETED,
      STORAGE_KEYS.ONBOARDING_STEP,
    ]);
  } catch (error) {
    console.error('Failed to reset onboarding:', error);
  }
};
