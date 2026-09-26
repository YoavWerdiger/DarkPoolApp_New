import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SoftUI } from '../components/ui/softUiPalette';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  backgroundImage: string;
  theme: {
    background: string;
    cardBackground: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    headerBorder: string;
    switchTrackOff: string;
    switchThumbOff: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem('appSettings');
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        setIsDarkMode(parsedSettings.darkMode ?? true);
      }
    } catch (error) {
    }
  };

  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    
    try {
      const saved = await AsyncStorage.getItem('appSettings');
      const settings = saved ? JSON.parse(saved) : {};
      const newSettings = { ...settings, darkMode: newTheme };
      await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
    } catch (error) {
    }
  };

  const backgroundImage = isDarkMode 
    ? `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/backgrounds/1.png`
    : `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/backgrounds/2.png`;

  const theme = {
    background: isDarkMode ? SoftUI.canvas : '#F5F5F7',
    cardBackground: isDarkMode ? SoftUI.surface1 : '#FFFFFF',
    textPrimary: isDarkMode ? SoftUI.textPrimary : '#000000',
    textSecondary: isDarkMode ? SoftUI.textSecondary : 'rgba(0,0,0,0.65)',
    textTertiary: isDarkMode ? SoftUI.textMuted : 'rgba(0,0,0,0.45)',
    border: isDarkMode ? SoftUI.borderSubtle : 'rgba(0,0,0,0.10)',
    headerBorder: isDarkMode ? SoftUI.borderSubtle : 'rgba(0,0,0,0.08)',
    switchTrackOff: isDarkMode ? '#252525' : '#E5E5E7',
    switchThumbOff: isDarkMode ? '#FFFFFF' : '#FFFFFF'
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, backgroundImage, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};