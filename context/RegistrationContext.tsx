import React, { createContext, useState, useContext, useCallback } from 'react';

export type RegistrationData = {
  // פרטים בסיסיים
  fullName: string;
  email: string;
  password: string;
  phone: string;
  profileImage: string | null;

  // אימות טלפון
  phoneVerified: boolean;
  phoneOtpSentAt: number | null;

  // אימות אימייל (OTP באמצע האשף)
  emailVerified: boolean;
  emailOtpSentAt: number | null;

  // נתוני המסלול
  trackId: string;

  /** שאלון קליטה — נשמר ב-users.intro_data */
  age: number | null;
  /** @deprecated - נשאר לתמיכה לאחור, החדש הוא age */
  ageRange: string;
  experienceLevel: string;
  tradingFocus: string;
  /** בחירה מרובה */
  tradingPlatform: string[];
  /** אופציונלי */
  portfolioSize: string;

  // סוג חשבון
  accountType: string;
  /** תצוגה בהמשך תהליך תשלום */
  trackName?: string;
  trackPrice?: number;

  // הרשמה עם Google
  isGoogleSignUp: boolean;
  googleUserId: string | null;

  /**
   * userId שנוצר לפני Cardcom (כדי שה-webhook יקבל מזהה אמיתי).
   * בסיכום — מעדכנים פרופיל במקום signUp מחדש.
   */
  pendingAuthUserId: string | null;
};

const defaultData: RegistrationData = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  profileImage: null,

  phoneVerified: false,
  phoneOtpSentAt: null,

  emailVerified: false,
  emailOtpSentAt: null,

  trackId: '',

  age: null,
  ageRange: '',
  experienceLevel: '',
  tradingFocus: '',
  tradingPlatform: [],
  portfolioSize: '',

  accountType: 'free',

  isGoogleSignUp: false,
  googleUserId: null,

  pendingAuthUserId: null,
};

type RegistrationContextType = {
  data: RegistrationData;
  setData: React.Dispatch<React.SetStateAction<RegistrationData>>;
  setGoogleUserData: (userData: { id: string; email: string; fullName: string; profileImage: string | null }) => void;
  resetData: () => void;
};

const RegistrationContext = createContext<RegistrationContextType>({
  data: defaultData,
  setData: () => {},
  setGoogleUserData: () => {},
  resetData: () => {},
});

export const RegistrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState(defaultData);

  // הגדרת נתוני משתמש Google - ידלג על שלבי פרטים אישיים ותמונה
  const setGoogleUserData = useCallback((userData: {
    id: string;
    email: string;
    fullName: string;
    profileImage: string | null
  }) => {
    setData(prev => ({
      ...prev,
      fullName: userData.fullName,
      email: userData.email,
      profileImage: userData.profileImage,
      isGoogleSignUp: true,
      googleUserId: userData.id,
      pendingAuthUserId: userData.id,
      emailVerified: true, // Google מאמת אימייל
      password: '', // לא צריך סיסמה להרשמה עם Google
    }));
  }, []);

  // איפוס נתוני הרשמה
  const resetData = useCallback(() => {
    setData(defaultData);
  }, []);

  return (
    <RegistrationContext.Provider value={{ data, setData, setGoogleUserData, resetData }}>
      {children}
    </RegistrationContext.Provider>
  );
};

export const useRegistration = () => useContext(RegistrationContext);
