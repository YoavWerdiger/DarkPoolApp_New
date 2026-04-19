import React, { createContext, useState, useContext, useCallback } from 'react';

type RegistrationData = {
  // פרטים בסיסיים
  fullName: string;
  email: string;
  password: string;
  phone: string;
  profileImage: string | null;
  
  // נתוני המסלול והניסיון
  trackId: string;
  experience: string;
  level: string;
  
  // שווקים וסגנון מסחר
  markets: string[];
  styles: string[];
  brokers: string[];
  style: string; // סגנון מסחר (day, swing, etc.)
  fullTime: string; // סטטוס סחר (full, part, passive)
  
  // מטרות וזמן
  goal: string;
  goals: string; // מטרות בטקסט חופשי
  communityGoals: string[];
  hours: string;
  
  // רשתות חברתיות ומידע נוסף
  socials: string[];
  heardFrom: string;
  wish: string;
  
  // סוג חשבון
  accountType: string;
  /** תצוגה בהמשך תהליך תשלום */
  trackName?: string;
  trackPrice?: number;
  
  // הרשמה עם Google
  isGoogleSignUp: boolean;
  googleUserId: string | null;
};

const defaultData: RegistrationData = {
  // פרטים בסיסיים
  fullName: '',
  email: '',
  password: '',
  phone: '',
  profileImage: null,
  
  // נתוני המסלול והניסיון
  trackId: '',
  experience: '',
  level: '',
  
  // שווקים וסגנון מסחר
  markets: [],
  styles: [],
  brokers: [],
  style: '',
  fullTime: '',
  
  // מטרות וזמן
  goal: '',
  goals: '',
  communityGoals: [],
  hours: '',
  
  // רשתות חברתיות ומידע נוסף
  socials: [],
  heardFrom: '',
  wish: '',
  
  // סוג חשבון
  accountType: 'free',
  
  // הרשמה עם Google
  isGoogleSignUp: false,
  googleUserId: null,
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