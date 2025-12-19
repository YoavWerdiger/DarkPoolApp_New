// Design Tokens - מערכת טוקנים עיצוביים דינמית
// =========================================
//
// כל ערכי העיצוב המרכזיים באפליקציה
// משתלב עם ThemeContext לתמיכה ב-Light/Dark Theme
// עיצוב מקצועי ומודרני עם פלטת צבעים משופרת
//

import React from 'react';
import { useTheme } from '../../context/ThemeContext';

// צבעי Dark Theme - פלטת צבעים מקצועית ומודרנית
const darkColors = {
  // Brand - ירוק כצבע ראשי
  primary: {
    main: '#05d157',      // ירוק ראשי
    dark: '#00B84A',      // ירוק כהה יותר
    darker: '#008F3A',    // ירוק כהה מאוד
    light: '#34D399',     // ירוק בהיר
    lighter: '#6EE7B7',   // ירוק בהיר מאוד
    // Gradients
    gradient: ['#05d157', '#00B84A'],
    glow: 'rgba(5, 209, 87, 0.3)',
  },
  secondary: {
    main: '#34D399',      // טורקיז-ירוק
    dark: '#10B981',
    light: '#6EE7B7',
  },
  accent: {
    main: '#00E5FF',      // כחול בהיר
    dark: '#0284C7',
    light: '#38BDF8',
  },

  // Background - רבדים של שחור ואפור כהה
  background: {
    primary: '#000000',           // שחור מלא
    secondary: '#0A0A0A',         // כמעט שחור
    tertiary: '#141414',          // אפור כהה מאוד
    elevated: '#1A1A1A',          // משטח מורם
    elevated2: '#242424',         // משטח מורם יותר
    overlay: 'rgba(0, 0, 0, 0.85)', // רקע דיאלוגים
  },

  // Chat
  bubbleMe: '#05d157',
  bubbleOther: '#1F1F1F',        // אפור כהה לבועות אחרים

  // Text - היררכיה ברורה של טקסט
  text: {
    primary: '#FFFFFF',           // טקסט ראשי
    secondary: 'rgba(255,255,255,0.75)', // טקסט משני
    tertiary: 'rgba(255,255,255,0.55)',  // טקסט מעומעם
    disabled: 'rgba(255,255,255,0.35)',  // טקסט מושבת
    inverse: '#000000',           // טקסט על רקע בהיר
    danger: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    info: '#3B82F6',
  },

  // Border - גבולות עדינים ומקצועיים
  border: {
    main: '#1F1F1F',              // גבול בסיסי
    primary: 'rgba(255,255,255,0.1)',  // גבול עדין
    active: 'rgba(5, 209, 87, 0.4)',   // גבול פעיל (ירוק)
    hover: 'rgba(255,255,255,0.15)',   // גבול hover
    divider: 'rgba(255,255,255,0.08)', // מפריד
  },
};

// צבעי Light Theme - עיצוב מקצועי ומודרני
const lightColors = {
  // Brand
  primary: {
    main: '#05d157',
    dark: '#00B84A',
    darker: '#008F3A',
    light: '#34D399',
    lighter: '#6EE7B7',
    gradient: ['#05d157', '#00B84A'],
    glow: 'rgba(5, 209, 87, 0.2)',
  },
  secondary: {
    main: '#34D399',
    dark: '#10B981',
    light: '#6EE7B7',
  },
  accent: {
    main: '#0284C7',
    dark: '#0369A1',
    light: '#38BDF8',
  },

  // Background
  background: {
    primary: '#F5F5F7',        // רקע ראשי בהיר
    secondary: '#FFFFFF',       // משטחים לבנים
    tertiary: '#E5E5E5',       // רקע משני
    elevated: '#FFFFFF',        // משטח מורם
    elevated2: '#FAFAFA',       // משטח מורם יותר
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  // Chat
  bubbleMe: '#DCF8C6',
  bubbleOther: '#FFFFFF',

  // Text
  text: {
    primary: '#000000',
    secondary: 'rgba(0,0,0,0.7)',
    tertiary: 'rgba(0,0,0,0.5)',
    disabled: 'rgba(0,0,0,0.3)',
    inverse: '#FFFFFF',
    danger: '#DC2626',
    success: '#10B981',
    warning: '#F59E0B',
    info: '#3B82F6',
  },

  // Border
  border: {
    main: 'rgba(0,0,0,0.12)',
    primary: 'rgba(0,0,0,0.1)',
    active: 'rgba(5, 209, 87, 0.4)',
    hover: 'rgba(0,0,0,0.15)',
    divider: 'rgba(0,0,0,0.08)',
  },
};

// Hook דינמי לקבלת DesignTokens בהתאם ל-Theme
// משתמש ב-ThemeContext - מתעדכן אוטומטית כשמחליפים theme!
export const useDesignTokens = () => {
  try {
    const { isDarkMode } = useTheme();

    // בחירת צבעים בהתאם ל-theme
    const themeColors = isDarkMode ? darkColors : lightColors;

    // שימוש ב-useMemo כדי לא ליצור אובייקט חדש בכל רינדור
    return React.useMemo(() => {
      const glassmorphism = staticTokens.glassmorphism;
      
      const tokens = {
        colors: {
          ...themeColors,
          ...staticColors,
        },
        ...staticTokens,
        // Helper function לקבלת glassmorphism styles
        getGlassCardStyle: (intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light') => ({
          backgroundColor: isDarkMode 
            ? glassmorphism.cardBackground.dark[intensity]
            : glassmorphism.cardBackground.light[intensity],
          borderWidth: 1,
          borderColor: isDarkMode
            ? glassmorphism.border.dark[intensity]
            : glassmorphism.border.light[intensity],
          // iOS style - rounded corners
          borderRadius: staticTokens.borderRadius.xl,
          // Subtle shadow for depth
          ...staticTokens.shadows.sm,
        }),
        // Helper function לקבלת glassmorphism עם primary border
        getGlassCardPrimaryStyle: (intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light') => ({
          backgroundColor: isDarkMode 
            ? glassmorphism.cardBackground.dark[intensity]
            : glassmorphism.cardBackground.light[intensity],
          borderWidth: 1.5,
          borderColor: glassmorphism.primaryBorder[intensity],
          borderRadius: staticTokens.borderRadius.xl,
          ...staticTokens.shadows.md,
        }),
      };
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DesignTokens.ts:135',message:'useDesignTokens returning tokens',data:{hasColors:!!tokens.colors,hasText:!!tokens.colors.text,isDarkMode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      return tokens;
    }, [isDarkMode]); // תלות ב-isDarkMode - מתעדכן כשמשתנה!
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DesignTokens.ts:135',message:'useDesignTokens error',data:{error:error?.message,errorStack:error?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Fallback to static tokens if hook fails
    const glassmorphism = staticTokens.glassmorphism;
    return {
      colors: {
        ...darkColors,
        ...staticColors,
      },
      ...staticTokens,
      getGlassCardStyle: (intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light') => ({
        backgroundColor: glassmorphism.cardBackground.dark[intensity],
        borderWidth: 1,
        borderColor: glassmorphism.border.dark[intensity],
        borderRadius: staticTokens.borderRadius.xl,
        ...staticTokens.shadows.sm,
      }),
      getGlassCardPrimaryStyle: (intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light') => ({
        backgroundColor: glassmorphism.cardBackground.dark[intensity],
        borderWidth: 1.5,
        borderColor: glassmorphism.primaryBorder[intensity],
        borderRadius: staticTokens.borderRadius.xl,
        ...staticTokens.shadows.md,
      }),
    };
  }
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
  // 🔤 Typography - טיפוגרפיה מקצועית ומודרנית
  typography: {
    fontFamily: {
      system: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      assistant: ['Assistant-ExtraBold', 'Assistant', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      mono: ['SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'monospace'],
    },
    fontSize: {
      xs: 11,      // קטן מאוד - תוויות, metadata
      sm: 13,      // קטן - טקסט משני
      base: 15,    // בסיסי - גוף טקסט
      lg: 17,      // גדול - הדגשות
      xl: 19,      // גדול יותר - כותרות משנה
      '2xl': 24,   // כותרת בינונית
      '3xl': 30,   // כותרת גדולה
      '4xl': 36,   // כותרת גדולה מאוד
      '5xl': 48,   // כותרת ענקית
    },
    fontWeight: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },
    lineHeight: {
      tight: 1.2,      // כותרות
      normal: 1.4,     // גוף טקסט
      relaxed: 1.6,    // טקסט ארוך
      loose: 1.8,      // טקסט מאוד ארוך
    },
    letterSpacing: {
      tighter: -0.5,
      tight: -0.25,
      normal: 0,
      wide: 0.25,
      wider: 0.5,
      widest: 1,
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

  // 🌫️ Shadows - צללים מקצועיים עם elevations
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    xs: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 12,
    },
    green: {
      shadowColor: '#05d157',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    greenGlow: {
      shadowColor: '#05d157',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 0,
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
    maxWidth: {
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
    containerPadding: {
      sm: 12,
      md: 16,
      lg: 20,
      xl: 24,
    },
  },

  // 🎨 Gradients - גרדיאנטים מקצועיים
  gradients: {
    primary: ['#05d157', '#00B84A'],
    primaryVertical: ['#05d157', '#00B84A'],
    primaryHorizontal: ['#05d157', '#00B84A'],
    dark: ['#000000', '#1A1A1A'],
    overlay: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)'],
    card: ['rgba(5, 209, 87, 0.1)', 'rgba(5, 209, 87, 0.05)'],
  },

  // ✨ Effects - אפקטים מיוחדים
  effects: {
    blur: {
      light: 10,
      medium: 20,
      heavy: 40,
    },
    glow: {
      primary: {
        shadowColor: '#05d157',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
      },
    },
  },

  // 🪟 Glassmorphism - אפקט זכוכית עדין בסגנון iOS
  glassmorphism: {
    // BlurView intensities (לשימוש עם expo-blur)
    blurIntensity: {
      subtle: 15,      // עדין מאוד - לכרטיסיות קלות
      light: 25,      // עדין - לכרטיסיות רגילות
      medium: 40,     // בינוני - לכרטיסיות מורמות
      strong: 60,     // חזק - לדיאלוגים ומודלים
    },
    // Tint colors ל-BlurView
    blurTint: {
      dark: 'dark' as const,
      light: 'light' as const,
      default: 'dark' as const,
    },
    // Background colors עם transparency לכרטיסיות זכוכית
    cardBackground: {
      // Dark theme
      dark: {
        subtle: 'rgba(26, 26, 26, 0.4)',      // עדין מאוד
        light: 'rgba(26, 26, 26, 0.6)',       // עדין
        medium: 'rgba(26, 26, 26, 0.75)',     // בינוני
        strong: 'rgba(26, 26, 26, 0.85)',     // חזק
      },
      // Light theme
      light: {
        subtle: 'rgba(255, 255, 255, 0.3)',
        light: 'rgba(255, 255, 255, 0.5)',
        medium: 'rgba(255, 255, 255, 0.7)',
        strong: 'rgba(255, 255, 255, 0.9)',
      },
    },
    // Border colors עם transparency
    border: {
      dark: {
        subtle: 'rgba(255, 255, 255, 0.05)',  // עדין מאוד
        light: 'rgba(255, 255, 255, 0.08)',   // עדין
        medium: 'rgba(255, 255, 255, 0.12)',   // בינוני
        strong: 'rgba(255, 255, 255, 0.18)',   // חזק
      },
      light: {
        subtle: 'rgba(0, 0, 0, 0.05)',
        light: 'rgba(0, 0, 0, 0.08)',
        medium: 'rgba(0, 0, 0, 0.12)',
        strong: 'rgba(0, 0, 0, 0.18)',
      },
    },
    // Primary accent border (ירוק)
    primaryBorder: {
      subtle: 'rgba(5, 209, 87, 0.2)',
      light: 'rgba(5, 209, 87, 0.3)',
      medium: 'rgba(5, 209, 87, 0.4)',
      strong: 'rgba(5, 209, 87, 0.6)',
    },
  },
};

// Export סטטי לתאימות לאחור (fallback ל-Dark Theme)
// שימו לב: עדיף להשתמש ב-useDesignTokens hook כדי לקבל ערכים דינמיים
export const DesignTokens = {
  colors: {
    ...darkColors,
    ...staticColors,
  },
  ...staticTokens,
  // Helper functions גם ב-export הסטטי
  getGlassCardStyle: (intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light') => ({
    backgroundColor: staticTokens.glassmorphism.cardBackground.dark[intensity],
    borderWidth: 1,
    borderColor: staticTokens.glassmorphism.border.dark[intensity],
    borderRadius: staticTokens.borderRadius.xl,
    ...staticTokens.shadows.sm,
  }),
  getGlassCardPrimaryStyle: (intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light') => ({
    backgroundColor: staticTokens.glassmorphism.cardBackground.dark[intensity],
    borderWidth: 1.5,
    borderColor: staticTokens.glassmorphism.primaryBorder[intensity],
    borderRadius: staticTokens.borderRadius.xl,
    ...staticTokens.shadows.md,
  }),
};

export default DesignTokens;

