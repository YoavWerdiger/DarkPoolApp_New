import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [isLoading, setIsLoading] = useState(true);

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
      console.error('Error loading theme:', error);
    } finally {
      setIsLoading(false);
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
      console.error('Error saving theme:', error);
    }
  };

  const backgroundImage = isDarkMode 
    ? 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/1.png'
    : 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/2.png';

  const theme = {
    background: isDarkMode ? '#121212' : '#F5F5F7',
    cardBackground: isDarkMode ? '#1A1A1A' : '#FFFFFF',
    textPrimary: isDarkMode ? '#FFFFFF' : '#000000',
    textSecondary: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
    textTertiary: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
    border: isDarkMode ? '#2a2a2a' : 'rgba(0,0,0,0.1)',
    headerBorder: isDarkMode ? '#1a1a1a' : 'rgba(0,0,0,0.1)',
    switchTrackOff: isDarkMode ? '#2a2a2a' : '#E5E5E7',
    switchThumbOff: isDarkMode ? '#4a4a4a' : '#FFFFFF'
  };

  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, backgroundImage, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};