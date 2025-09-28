import React, { createContext, useState, useContext } from 'react';

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
  
  // מטרות וזמן
  goal: string;
  communityGoals: string[];
  hours: string;
  
  // רשתות חברתיות ומידע נוסף
  socials: string[];
  heardFrom: string;
  wish: string;
  
  // סוג חשבון
  accountType: string;
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
  
  // מטרות וזמן
  goal: '',
  communityGoals: [],
  hours: '',
  
  // רשתות חברתיות ומידע נוסף
  socials: [],
  heardFrom: '',
  wish: '',
  
  // סוג חשבון
  accountType: 'free',
};

const RegistrationContext = createContext<{
  data: RegistrationData;
  setData: React.Dispatch<React.SetStateAction<RegistrationData>>;
}>({
  data: defaultData,
  setData: () => {},
});

export const RegistrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState(defaultData);
  return (
    <RegistrationContext.Provider value={{ data, setData }}>
      {children}
    </RegistrationContext.Provider>
  );
};

export const useRegistration = () => useContext(RegistrationContext); 