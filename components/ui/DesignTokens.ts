// Design Tokens - מערכת טוקנים עיצוביים
// =========================================
//
// כל ערכי העיצוב המרכזיים באפליקציה
// בהשפעת WhatsApp עם עיצוב מקצועי ומודרני
//

export const DesignTokens = {
  // 🎨 Colors - צבעים
  colors: {
    // Brand
    primary: {
      main: '#05d157',        // ירוק ראשי (כמו העיצוב החדש)
    },
    secondary: {
      main: '#34D399',        // ירוק משני
    },
    accent: {
      main: '#00E5FF',        // כחול להדגשות
    },
    
    // Background
    background: {
      primary: '#0d0d0d',     // רקע ראשי (כמעט שחור)
      secondary: '#1a1a1a',   // משטחים (כהה יותר)
      tertiary: '#1a1a1a',    // רכיבים מורמים
    },
    
    // Chat
    bubbleMe: '#05d157',       // בועות שלי
    bubbleOther: '#1a1a1a',    // בועות אחרים
    
    // Text
    text: {
      primary: '#FFFFFF',         // טקסט ראשי
      secondary: 'rgba(255,255,255,0.6)',  // טקסט משני
      tertiary: 'rgba(255,255,255,0.5)',   // טקסט מעומעם
      danger: '#EF4444',          // טקסט שגיאה
    },
    
    // Border
    border: {
      primary: 'rgba(255,255,255,0.08)',      // גבולות בסיסיים
      active: 'rgba(255,255,255,0.12)',       // גבולות פעילים
    },
    
    // States
    success: {
      main: '#10B981',        // הצלחה
    },
    warning: {
      main: '#F59E0B',        // אזהרה
    },
    danger: {
      main: '#EF4444',        // סכנה
    },
    info: {
      main: '#3B82F6',        // מידע
    },
    
    // Overlay
    overlay: 'rgba(0,0,0,0.6)', // רקע דיאלוגים
    backdrop: 'rgba(0,0,0,0.4)', // רקע מעומעם
  },

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

  // 🪟 Glass / Liquid Glass — ערכי טישטוש ושכבת-על (מסונכרנים עם מערכת העיצוב)
  glass: {
    blur: {
      frosted: 72,
      translucent: 40,
      subtle: 24,
    },
    overlay: {
      frostedDark: 'rgba(255,255,255,0.08)',
      frostedLight: 'rgba(255,255,255,0.18)',
      translucentDark: 'rgba(255,255,255,0.04)',
      translucentLight: 'rgba(255,255,255,0.12)',
    },
    fallback: {
      dark: 'rgba(26,26,26,0.92)',
      light: 'rgba(245,245,245,0.94)',
    },
    border: 'rgba(255,255,255,0.1)',
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

export default DesignTokens;

