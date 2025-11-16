// Design Tokens - מערכת טוקנים עיצוביים דינמית
// =========================================
//
// כל ערכי העיצוב המרכזיים באפליקציה
// משתלב עם ThemeContext לתמיכה ב-Light/Dark Theme
//

import React from 'react';
import { useTheme } from '../../context/ThemeContext';

// צבעי Dark Theme
const darkColors = {
  // Brand
  primary: {
    main: '#05d157',
    dark: '#00B84A',
    darker: '#008F3A',
  },
  secondary: {
    main: '#34D399',
  },
  accent: {
    main: '#00E5FF',
  },
  
  // Background
  background: {
    primary: '#121212',
    secondary: '#1A1A1A',
    tertiary: '#2A2A2A',
  },
  
  // Chat
  bubbleMe: '#05d157',
  bubbleOther: '#1a1a1a',
  
  // Text
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255,255,255,0.6)',
    tertiary: 'rgba(255,255,255,0.5)',
    danger: '#EF4444',
  },
  
  // Border
  border: {
    main: '#2a2a2a',
    primary: 'rgba(255,255,255,0.08)',
    active: 'rgba(255,255,255,0.12)',
  },
};

// צבעי Light Theme
const lightColors = {
  // Brand
  primary: {
    main: '#05d157',
    dark: '#00B84A',
    darker: '#008F3A',
  },
  secondary: {
    main: '#34D399',
  },
  accent: {
    main: '#0284C7',
  },
  
  // Background
  background: {
    primary: '#F5F5F7',
    secondary: '#FFFFFF',
    tertiary: '#E5E5E5',
  },
  
  // Chat
  bubbleMe: '#DCF8C6',
  bubbleOther: '#FFFFFF',
  
  // Text
  text: {
    primary: '#000000',
    secondary: 'rgba(0,0,0,0.6)',
    tertiary: 'rgba(0,0,0,0.4)',
    danger: '#DC2626',
  },
  
  // Border
  border: {
    main: 'rgba(0,0,0,0.1)',
    primary: 'rgba(0,0,0,0.08)',
    active: 'rgba(0,0,0,0.12)',
  },
};

// Hook דינמי לקבלת DesignTokens בהתאם ל-Theme
// משתמש ב-ThemeContext - מתעדכן אוטומטית כשמחליפים theme!
export const useDesignTokens = () => {
  const { isDarkMode } = useTheme();
  
  // Log לדיבאג
  console.log('🎨 useDesignTokens נקרא! isDarkMode =', isDarkMode);
  
  // בחירת צבעים בהתאם ל-theme
  const themeColors = isDarkMode ? darkColors : lightColors;
  
  console.log('🎨 Theme נבחר:', isDarkMode ? '🌙 Dark' : '☀️ Light');
  console.log('🎨 צבע רקע:', themeColors.background.primary);
  console.log('🎨 צבע טקסט:', themeColors.text.primary);
  
  // שימוש ב-useMemo כדי לא ליצור אובייקט חדש בכל רינדור
  return React.useMemo(() => ({
    colors: {
      ...themeColors,
      ...staticColors,
    },
    ...staticTokens,
  }), [isDarkMode]); // תלות ב-isDarkMode - מתעדכן כשמשתנה!
};

// צבעים סטטיים (לא משתנים בין themes)
const staticColors = {
  success: {
    main: '#10B981',
  },
  warning: {
    main: '#F59E0B',
  },
  danger: {
    main: '#EF4444',
  },
  info: {
    main: '#3B82F6',
  },
  overlay: 'rgba(0,0,0,0.6)',
  backdrop: 'rgba(0,0,0,0.4)',
};

// טוקנים סטטיים (לא משתנים בין themes)
const staticTokens = {
  // 🔤 Typography - טיפוגרפיה
  typography: {
    fontFamily: {
      system: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      assistant: ['Assistant-ExtraBold', 'Assistant', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
    },
    fontSize: {
      xs: 12,    // קטן מאוד
      sm: 14,    // קטן
      base: 16,  // בסיסי
      lg: 18,    // גדול
      xl: 20,    // גדול יותר
      '2xl': 24, // כותרת
      '3xl': 32, // כותרת גדולה
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.4,
      relaxed: 1.6,
    },
  },

  // 📏 Spacing - מרווחים
  spacing: {
    xs: 4,    // 4px
    sm: 8,    // 8px
    md: 12,   // 12px
    lg: 16,   // 16px
    xl: 20,   // 20px
    '2xl': 24, // 24px
    '3xl': 32, // 32px
    '4xl': 40, // 40px
    '5xl': 48, // 48px
  },

  // 🔄 Border Radius - עגלול פינות
  borderRadius: {
    none: 0,
    sm: 8,     // קטן
    md: 12,    // בינוני
    lg: 16,    // גדול
    xl: 20,    // גדול יותר
    '2xl': 24, // גדול מאוד
    '3xl': 30, // עגול מאוד
    full: 9999, // עגול מלא
  },

  // 🌫️ Shadows - צללים
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
    green: {
      shadowColor: '#05d157',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
  },

  // ⚡ Animation - אנימציות
  animation: {
    duration: {
      fast: 150,
      normal: 250,
      slow: 400,
    },
    easing: {
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
    },
    spring: {
      tension: 100,
      friction: 8,
    },
  },

  // 📐 Layout - פריסה
  layout: {
    headerHeight: 60,
    tabBarHeight: 80,
    borderWidth: {
      thin: 0.5,
      normal: 1,
      thick: 2,
    },
  },
};

// Export סטטי לתאימות לאחור (fallback ל-Dark Theme)
export const DesignTokens = {
  colors: {
    ...darkColors,
    ...staticColors,
  },
  ...staticTokens,
};

export default DesignTokens;

