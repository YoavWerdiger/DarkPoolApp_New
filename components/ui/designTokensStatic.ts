import { APP_LAYOUT } from './appLayout';

export { SoftUI } from './softUiPalette';
import { SoftUI } from './softUiPalette';

// Dark Theme — Soft UI / warm charcoal (not terminal neon)
const darkColors = {
  primary: {
    main: SoftUI.brand,
    dark: SoftUI.brandDark,
    darker: '#008F03',
    light: SoftUI.brandLight,
    lighter: '#5CFF5C',
    dim: 'rgba(0, 200, 5, 0.12)',
    glow: 'rgba(0, 200, 5, 0.35)',
    subtle: 'rgba(0, 200, 5, 0.06)',
    gradient: [SoftUI.brand, SoftUI.brandDark],
    /** מילוי CTA ראשי בכהה — גלולה לבנה. ירוק המותג נשאר accent, לא מילוי הכפתור. */
    lightCta: '#FFFFFF',
  },
  secondary: {
    main: SoftUI.textSecondary,
    dark: SoftUI.textMuted,
    light: SoftUI.textPrimary,
  },
  accent: {
    main: SoftUI.accentBlue,
    dark: '#6278D4',
    light: '#94A8F5',
  },

  background: {
    primary: SoftUI.canvas,
    screen: SoftUI.canvas,
    secondary: SoftUI.surface1,
    tertiary: SoftUI.surface2,
    elevated: SoftUI.surface2,
    elevated2: SoftUI.surface3,
    card: SoftUI.surface1,
    cardHover: SoftUI.surfaceHover,
    cardSolid: SoftUI.surface1,
    /** כפתורי כרום / שדות צף — surface2 על canvas */
    navChrome: SoftUI.surface2,
    surface: SoftUI.surface1,
    input: SoftUI.surface1,
    header: SoftUI.canvas,
    tabBar: SoftUI.canvas,
    tabActive: SoftUI.brand,
    sheet: SoftUI.surface2,
    overlay: 'rgba(0, 0, 0, 0.60)',
    overlayHeavy: 'rgba(0, 0, 0, 0.85)',
  },

  /** בועות צ'אט — ירוק/אפור המקוריים (אטום, לא Soft UI surface) */
  bubbleMe: '#134D37',
  bubbleOther: SoftUI.surface2,
  bubbleMeText: '#FFFFFF',
  bubbleMeMetaText: 'rgba(255, 255, 255, 0.65)',

  text: {
    primary: SoftUI.textPrimary,
    secondary: SoftUI.textSecondary,
    tertiary: SoftUI.textMuted,
    muted: SoftUI.textMuted,
    disabled: SoftUI.textMuted,
    inverse: '#1A1918',
    accent: SoftUI.brand,
    danger: SoftUI.negative,
    success: SoftUI.brand,
    warning: SoftUI.warning,
    info: SoftUI.accentBlue,
  },

  selection: {
    subtle: 'rgba(255, 255, 255, 0.06)',
  },

  border: {
    main: SoftUI.borderSubtle,
    default: SoftUI.borderSubtle,
    primary: SoftUI.borderSubtle,
    subtle: 'rgba(255, 255, 255, 0.04)',
    strong: 'rgba(255, 255, 255, 0.10)',
    accent: 'rgba(0, 200, 5, 0.30)',
    active: 'rgba(0, 200, 5, 0.30)',
    danger: 'rgba(239, 68, 68, 0.25)',
    hover: 'rgba(255, 255, 255, 0.08)',
    divider: 'rgba(244, 242, 241, 0.10)',
  },

  glass: {
    card: {
      bg: SoftUI.surface1,
      border: SoftUI.borderSubtle,
    },
    cardElevated: {
      bg: SoftUI.surface2,
      border: SoftUI.borderSubtle,
    },
    sheet: {
      bg: SoftUI.surface2,
      border: SoftUI.borderSubtle,
    },
    header: {
      bg: SoftUI.canvas,
      border: 'rgba(255, 255, 255, 0)',
    },
    tabBar: {
      bg: SoftUI.canvas,
      border: 'rgba(255, 255, 255, 0)',
    },
  },
};

/** קנבס מסך במצב בהיר */
export const LIGHT_CANVAS = '#F4F2F1';
/** כרטיס אטום במצב בהיר (UICard soft / דיאלוג) */
export const LIGHT_CARD = '#FFFFFF';
/** טקסט ראשי (כותרת / גוף) על הקנבס והכרטיס הלבן */
export const LIGHT_TEXT_PRIMARY = '#1E1A24';

// Light Theme
const lightColors = {
  primary: {
    main: '#00B84A',
    dark: '#009E3E',
    darker: '#008534',
    light: '#34E68A',
    lighter: '#6EE7B7',
    dim: 'rgba(0, 184, 74, 0.12)',
    glow: 'rgba(0, 184, 74, 0.25)',
    subtle: 'rgba(0, 184, 74, 0.06)',
    gradient: ['#00B84A', '#009E3E'],
    /** מילוי CTA ראשי בבהיר — גלולה שחורה, לא ירוק. */
    lightCta: '#010000',
  },
  secondary: {
    main: '#34D399',
    dark: '#10B981',
    light: '#6EE7B7',
  },
  accent: {
    main: '#2563EB',
    dark: '#1D4ED8',
    light: '#60A5FA',
  },

  background: {
    primary: LIGHT_CANVAS,
    screen: LIGHT_CANVAS,
    secondary: LIGHT_CARD,
    tertiary: '#E8E8ED',
    elevated: LIGHT_CARD,
    elevated2: '#FAFAFA',
    card: LIGHT_CARD,
    cardHover: 'rgba(0, 0, 0, 0.05)',
    cardSolid: LIGHT_CARD,
    navChrome: LIGHT_CARD,
    surface: LIGHT_CARD,
    input: 'rgba(0, 0, 0, 0.04)',
    header: 'rgba(244, 242, 241, 0.85)',
    tabBar: 'rgba(244, 242, 241, 0.95)',
    tabActive: '#00B84A',
    sheet: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.50)',
    overlayHeavy: 'rgba(0, 0, 0, 0.70)',
  },

  /** light: אותו עיקרון — מרכיבים rgba כמו בקודם מעל רקע #F4F2F1 */
  bubbleMe: '#C8F4CA', // מעט יותר “פגז” / בולט
  bubbleOther: '#FAFAFA',
  bubbleMeText: '#0A0E0A',
  bubbleMeMetaText: 'rgba(10, 14, 10, 0.55)',

  text: {
    primary: LIGHT_TEXT_PRIMARY,
    secondary: 'rgba(0, 0, 0, 0.65)',
    tertiary: 'rgba(0, 0, 0, 0.45)',
    muted: 'rgba(0, 0, 0, 0.30)',
    disabled: 'rgba(0, 0, 0, 0.30)',
    inverse: '#FFFFFF',
    accent: '#00B84A',
    danger: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    info: '#3B82F6',
  },

  selection: {
    subtle: 'rgba(0, 0, 0, 0.06)',
  },

  border: {
    main: 'rgba(0, 0, 0, 0.10)',
    default: 'rgba(0, 0, 0, 0.10)',
    primary: 'rgba(0, 0, 0, 0.10)',
    subtle: 'rgba(0, 0, 0, 0.04)',
    strong: 'rgba(0, 0, 0, 0.18)',
    accent: 'rgba(0, 184, 74, 0.30)',
    active: 'rgba(0, 184, 74, 0.30)',
    danger: 'rgba(239, 68, 68, 0.30)',
    hover: 'rgba(0, 0, 0, 0.15)',
    divider: 'rgba(0, 0, 0, 0.10)',
  },

  glass: {
    card: {
      bg: 'rgba(255, 255, 255, 0.65)',
      border: 'rgba(0, 0, 0, 0.08)',
    },
    cardElevated: {
      bg: 'rgba(255, 255, 255, 0.80)',
      border: 'rgba(0, 0, 0, 0.10)',
    },
    sheet: {
      bg: 'rgba(255, 255, 255, 0.97)',
      border: 'rgba(0, 0, 0, 0.08)',
    },
    header: {
      bg: 'rgba(244, 242, 241, 0.85)',
      border: 'rgba(0, 0, 0, 0.06)',
    },
    tabBar: {
      bg: 'rgba(244, 242, 241, 0.95)',
      border: 'rgba(0, 0, 0, 0.06)',
    },
  },
};

// Static semantic colors (theme-independent)
const staticColors = {
  success: { main: SoftUI.brand },
  warning: { main: SoftUI.warning },
  danger: { main: SoftUI.negative },
  info: { main: SoftUI.accentBlue },
  overlay: 'rgba(0,0,0,0.6)',
  backdrop: 'rgba(0,0,0,0.4)',
};

// Static tokens (theme-independent)
const staticTokens = {
  typography: {
    fontFamily: {
      system: ['Heebo_400Regular', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      assistant: ['Heebo_700Bold', 'Heebo_400Regular', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      mono: ['SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'monospace'],
    },
    fontSize: {
      micro: 9,
      '2xs': 10,
      xs: 11,
      sm: 12,
      base: 16,
      lg: 17,
      xl: 18,
      '2xl': 22,
      '3xl': 28,
      '4xl': 34,
      '5xl': 40,
    },
    display: { size: 40, weight: '700' as const, letterSpacing: -1.2, lineHeight: 46 },
    heroTitle: { size: 34, weight: '700' as const, letterSpacing: -0.8, lineHeight: 40 },
    title: { size: 28, weight: '700' as const, letterSpacing: -0.4, lineHeight: 34 },
    title2: { size: 22, weight: '800' as const, letterSpacing: -0.42, lineHeight: 28 },
    subtitle: { size: 15, weight: '400' as const, letterSpacing: 0, lineHeight: 22 },
    body: { size: 16, weight: '400' as const, letterSpacing: 0, lineHeight: 24 },
    bodyMedium: { size: 16, weight: '500' as const, letterSpacing: 0, lineHeight: 24 },
    bodySemiBold: { size: 16, weight: '600' as const, letterSpacing: 0, lineHeight: 24 },
    callout: { size: 15, weight: '400' as const, letterSpacing: 0, lineHeight: 22 },
    subhead: { size: 14, weight: '500' as const, letterSpacing: 0, lineHeight: 20 },
    footnote: { size: 13, weight: '400' as const, letterSpacing: 0.1, lineHeight: 18 },
    caption: { size: 12, weight: '500' as const, letterSpacing: 0.2, lineHeight: 16 },
    caption2: { size: 11, weight: '600' as const, letterSpacing: 0.3, lineHeight: 14 },
    label: { size: 14, weight: '600' as const, letterSpacing: 0.5, lineHeight: 20 },
    button: { size: 17, weight: '700' as const, letterSpacing: 0, lineHeight: 22 },
    buttonSmall: { size: 14, weight: '600' as const, letterSpacing: 0.2, lineHeight: 18 },
    tabBarLabel: { size: 10, weight: '500' as const, letterSpacing: 0.3, lineHeight: 14 },
    // Backward compat aliases
    displaySmall: { size: 28, weight: '700' as const, letterSpacing: -0.5, lineHeight: 34 },
    displayXs: { size: 22, weight: '700' as const, letterSpacing: -0.3, lineHeight: 28 },
    titleSmall: { size: 18, weight: '600' as const, letterSpacing: 0, lineHeight: 24 },
    titleXs: { size: 17, weight: '600' as const, letterSpacing: 0, lineHeight: 22 },
    bodySmall: { size: 14, weight: '400' as const, letterSpacing: 0, lineHeight: 20 },
    captionSmall: { size: 11, weight: '600' as const, letterSpacing: 0.3, lineHeight: 14 },
    fontWeight: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    } as const,
    lineHeight: {
      tight: 1.15,
      normal: 1.4,
      relaxed: 1.6,
      loose: 1.8,
    },
    letterSpacing: {
      tighter: -1.5,
      tight: -0.5,
      normal: 0,
      wide: 0.2,
      wider: 0.5,
      widest: 1,
    },
  },

  /**
   * Spacing Scale - מרחקים סטנדרטיים
   * 
   * שימוש מומלץ:
   * - 2xs (2px): מרווחים מיקרו בין אלמנטים קטנים מאוד
   * - xs (4px): מרווח מינימלי בין אייקונים לטקסט
   * - sm (8px): מרווח בין אלמנטים קטנים
   * - md (12px): מרווח סטנדרטי בין קומפוננטות
   * - base (16px): מרווח בסיס בין אלמנטים
   * - lg (20px): padding מסכים, מרווח בין sections
   * - xl (24px): מרווח גדול בין sections
   * - 2xl (32px): מרווח גדול מאוד, padding של כרטיסים גדולים
   * - 3xl (40px): מרווח hero sections
   * - 4xl (48px): מרווח בין אזורים מרכזיים
   * - 5xl (64px): מרווח maximum למסכים מיוחדים
   */
  spacing: {
    '2xs': 2,
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 40,
    '4xl': 48,
    '5xl': 64,
    '6xl': 80,
    '7xl': 96,
  },

  /**
   * Border Radius Scale - עיגול פינות סטנדרטי
   * 
   * שימוש מומלץ:
   * - none (0): אין עיגול
   * - xs (4px): עיגול מינימלי (badges קטנים)
   * - sm (8px): עיגול קטן (pills, chips)
   * - md (12px): עיגול סטנדרטי לכרטיסים קטנים
   * - lg (16px): עיגול בסיס לכרטיסים (**המומלץ לרוב הכרטיסים**)
   * - xl (20px): עיגול גדול לכרטיסים מרכזיים
   * - 2xl (24px): עיגול גדול מאוד לאלמנטים hero
   * - 3xl (30px): עיגול מקסימלי (כרטיסי פיד, modals)
   * - full (9999): עיגול מלא (כפתורים עגולים, אווטרים)
   * - search (9999): שורת חיפוש — pill מלא בכל האפליקציה
   * - button (9999): pill מלא לכפתורים (אל תשתמש ב-borderRadius אחר לכפתורים!)
   */
  borderRadius: {
    none: 0,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 20,
    xl: 24,
    '2xl': 28,
    '3xl': 28,
    full: 9999,
    /** שורת חיפוש — pill. אין להגדיר רדיוס חיפוש פר-מסך קטן מזה. */
    search: 9999,
    /** כל כפתור באפליקציה — pill. אין להגדיר רדיוס כפתור פר-מסך. */
    button: 9999,
  },

  /**
   * יישור טקסט עברי — הבסיס של עץ הלייאאוט הוא `direction: 'ltr'` (App.tsx),
   * ולכן טקסט בעברית חייב יישור מפורש. בלי `writingDirection` מחרוזות עם ספרות /
   * פיסוק (`+3 החודש`, `שם · תאריך`) מסתדרות לפי כללי BiDi של פסקה לטינית ונראות הפוכות.
   */
  rtlText: {
    textAlign: 'right' as const,
    writingDirection: 'rtl' as const,
  },

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
    /** Soft UI trial: כרטיסים שטוחים — בלי צל */
    card: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    green: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    greenGlow: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  },

  animation: {
    duration: {
      fast: 100,
      normal: 200,
      slow: 300,
    },
    easing: {
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
    },
    spring: {
      tension: 150,
      friction: 15,
    },
    springPresets: {
      default: { damping: 15, stiffness: 150, mass: 0.5 },
      snappy: { damping: 20, stiffness: 300 },
      gentle: { damping: 20, stiffness: 100, mass: 0.8 },
      bouncy: { damping: 10, stiffness: 150, mass: 0.5 },
    },
  },

  layout: {
    headerHeight: 56,
    tabBarHeight: 56,
    screenPadding: APP_LAYOUT.screenPaddingHorizontal,
    cardPadding: APP_LAYOUT.cardPadding,
    sectionGap: APP_LAYOUT.sectionGap,
    sectionHeaderToContent: APP_LAYOUT.sectionHeaderToContent,
    componentGap: APP_LAYOUT.componentGap,
    cardStackGap: APP_LAYOUT.cardStackGap,
    stackGapTight: APP_LAYOUT.stackGapTight,
    stackGapSmall: APP_LAYOUT.stackGapSmall,
    listItemHeight: 60,
    avatarSize: {
      xs: 28,
      sm: 36,
      md: 44,
      lg: 56,
      xl: 72,
    },
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

  gradients: {
    primary: [SoftUI.brand, SoftUI.brandDark],
    primaryVertical: [SoftUI.brand, SoftUI.brandDark],
    primaryHorizontal: [SoftUI.brand, SoftUI.brandDark],
    dark: [SoftUI.canvas, SoftUI.surface1],
    overlay: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)'],
    card: [SoftUI.surface1, SoftUI.surface1],
    screen: [SoftUI.canvas, SoftUI.canvas, SoftUI.canvas, SoftUI.canvas],
    screenStart: { x: 0.5, y: 0 },
    screenEnd: { x: 0.5, y: 1 },
  },

  effects: {
    blur: {
      light: 10,
      medium: 20,
      heavy: 40,
    },
    glow: {
      primary: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
      },
    },
  },

  glassmorphism: {
    /**
     * עוצמת BlurView. חייב להישאר גבוה מספיק כדי שהטשטוש ייקרא כזכוכית —
     * מתחת ל־24 ה־BlurView כמעט בלתי נראה מאחורי ה־overlay.
     */
    blurIntensity: {
      subtle: 32,
      light: 48,
      medium: 62,
      strong: 80,
    },
    blurTint: {
      dark: 'systemThinMaterialDark' as const,
      light: 'systemThinMaterialLight' as const,
      default: 'systemThinMaterialDark' as const,
    },
    /** משטח כרטיס כהה — אטום, בלי שכבת לבן (Soft UI). */
    cardBackground: {
      dark: {
        subtle: SoftUI.surface1,
        light: SoftUI.surface1,
        medium: SoftUI.surface2,
        strong: SoftUI.surface3,
      },
      light: {
        subtle: 'rgba(255, 255, 255, 0.42)',
        light: 'rgba(255, 255, 255, 0.56)',
        medium: 'rgba(255, 255, 255, 0.70)',
        strong: 'rgba(255, 255, 255, 0.82)',
      },
    },
    /**
     * רצפה שקופה־למחצה כשאין BlurView (שורות פיד / view-shot / Android ישן).
     * אותה שפה בשתי הפלטפורמות — לא #111111 / #262626 אטום.
     */
    baseFill: {
      dark: SoftUI.surface1,
      light: 'rgba(255, 255, 255, 0.42)',
    },
    border: {
      dark: {
        subtle: SoftUI.borderSubtle,
        light: SoftUI.borderSubtle,
        medium: 'rgba(255, 255, 255, 0.08)',
        strong: 'rgba(255, 255, 255, 0.10)',
      },
      light: {
        subtle: 'rgba(0, 0, 0, 0.06)',
        light: 'rgba(0, 0, 0, 0.10)',
        medium: 'rgba(0, 0, 0, 0.12)',
        strong: 'rgba(0, 0, 0, 0.16)',
      },
    },
    topHighlight: {
      dark: {
        subtle: SoftUI.borderSubtle,
        light: SoftUI.borderSubtle,
        medium: SoftUI.borderSubtle,
        strong: SoftUI.borderSubtle,
      },
      light: {
        subtle: 'rgba(255, 255, 255, 0.40)',
        light: 'rgba(255, 255, 255, 0.55)',
        medium: 'rgba(255, 255, 255, 0.70)',
        strong: 'rgba(255, 255, 255, 0.88)',
      },
    },
    primaryBorder: {
      subtle: 'rgba(0, 200, 5, 0.10)',
      light: 'rgba(0, 200, 5, 0.20)',
      medium: 'rgba(0, 200, 5, 0.30)',
      strong: 'rgba(0, 200, 5, 0.45)',
    },
    shadow: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  },

  /**
   * משטח שדות רישום / onboarding — זכוכית כהה עם מסגרת highlight.
   * blurIntensity משמש ב־UICard variant="inputGlass" בשתי הפלטפורמות.
   */
  onboardingInputSurface: {
    backgroundColor: SoftUI.surface1,
    borderWidth: 1,
    borderColor: SoftUI.borderSubtle,
    blurIntensity: 0,
    androidFallback: SoftUI.surface1,
  },

  /**
   * Cash App Style Onboarding Tokens
   * בהשראת ניתוח Cash App onboarding flow
   */
  cashAppStyle: {
    colors: {
      // Primary - שחור לכפתורים ראשיים (כמו Cash App)
      buttonPrimary: '#000000',
      buttonPrimaryText: '#FFFFFF',
      
      // Secondary - אפור בהיר לכפתורים משניים
      buttonSecondary: '#F5F5F5',
      buttonSecondaryText: LIGHT_TEXT_PRIMARY,
      
      // Disabled
      buttonDisabled: '#E0E0E0',
      buttonDisabledText: '#999999',
      
      // Backgrounds - נקיים ופשוטים
      screen: '#FFFFFF',
      card: '#FAFAFA',
      input: '#F8F8F8',
      
      // Text
      headline: LIGHT_TEXT_PRIMARY,
      body: '#666666',
      secondary: '#999999',
      placeholder: '#BBBBBB',
      
      // Borders
      input: '#E0E0E0',
      /** @deprecated — השתמשו ב-formControl / FORM_FIELD_FOCUS_BORDER */
      inputFocus: 'rgba(255, 255, 255, 0.22)',
      subtle: '#F0F0F0',
      
      // States
      error: '#EF4444',
      success: '#00C805',
      warning: '#FFB800',
    },
    
    typography: {
      // Headlines - גדולות ו-bold כמו Cash App
      headline: {
        fontSize: 28,
        fontWeight: '700' as const,
        letterSpacing: -0.5,
        lineHeight: 34,
      },
      
      // Subheadline - תיאור משני
      subheadline: {
        fontSize: 16,
        fontWeight: '400' as const,
        lineHeight: 24,
      },
      
      // Body - טקסט רגיל
      body: {
        fontSize: 16,
        fontWeight: '400' as const,
        lineHeight: 24,
      },
      
      // Button - bold וברור
      button: {
        fontSize: 17,
        fontWeight: '700' as const,
        letterSpacing: 0,
      },
      
      // Caption - טקסט עזר קטן
      caption: {
        fontSize: 12,
        fontWeight: '400' as const,
        lineHeight: 16,
      },
    },
    
    spacing: {
      screenPadding: 20,        // מרווח מסכים
      elementGap: 16,           // בין אלמנטים
      sectionGap: 24,           // בין סקשנים
      buttonHeight: 56,         // גובה כפתור סטנדרטי
      inputHeight: 56,          // גובה שדה קלט
      progressDotSize: 8,       // גודל נקודת progress
      progressDotGap: 8,        // מרווח בין נקודות
    },
    
    borderRadius: {
      input: 12,                // שדות קלט
      button: 28,               // כפתורים (pill)
      card: 16,                 // כרטיסים
      full: 9999,              // עיגול מלא
    },
    
    animations: {
      // Page transitions
      pageTransition: {
        duration: 300,
        easing: 'ease-in-out' as const,
      },
      
      // Button press
      buttonPress: {
        scale: 0.97,
        duration: 100,
      },
      
      // Input focus
      inputFocus: {
        duration: 200,
        easing: 'ease-out' as const,
      },
      
      // Progress indicator
      progressDot: {
        duration: 200,
        scale: 1.2,
      },
    },
  },
};

export type DesignTokensThemeBundle = {
  colors: typeof darkColors & typeof staticColors;
} & typeof staticTokens & {
    getGlassCardStyle: (
      intensity?: 'subtle' | 'light' | 'medium' | 'strong',
    ) => ReturnType<typeof buildGlassCardStyle>;
    getGlassCardPrimaryStyle: (
      intensity?: 'subtle' | 'light' | 'medium' | 'strong',
    ) => ReturnType<typeof buildGlassCardPrimaryStyle>;
  };

function buildGlassCardStyle(
  isDarkMode: boolean,
  _intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light',
) {
  return {
    backgroundColor: isDarkMode
      ? darkColors.background.cardSolid
      : lightColors.background.cardSolid,
    borderWidth: 0,
    borderRadius: staticTokens.borderRadius.xl,
    ...staticTokens.shadows.none,
  };
}

function buildGlassCardPrimaryStyle(
  intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light',
) {
  const glassmorphism = staticTokens.glassmorphism;
  return {
    backgroundColor: glassmorphism.cardBackground.dark[intensity],
    borderWidth: 1,
    borderColor: glassmorphism.primaryBorder[intensity],
    borderRadius: staticTokens.borderRadius.xl,
    ...glassmorphism.shadow,
  };
}

/** בונה טוקנים לפי theme — ללא React (ל-hook נפרד). */
export function createDesignTokensForTheme(isDarkMode: boolean): DesignTokensThemeBundle {
  const themeColors = isDarkMode ? darkColors : lightColors;
  return {
    colors: {
      ...themeColors,
      ...staticColors,
    },
    ...staticTokens,
    getGlassCardStyle: (intensity = 'light' as const) =>
      buildGlassCardStyle(isDarkMode, intensity),
    getGlassCardPrimaryStyle: (intensity = 'light' as const) =>
      buildGlassCardPrimaryStyle(intensity),
  };
}

// Static export for backward compatibility (defaults to dark theme)
export const DesignTokens = {
  colors: {
    ...darkColors,
    ...staticColors,
  },
  ...staticTokens,
  getGlassCardStyle: (_intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light') => ({
    backgroundColor: darkColors.background.cardSolid,
    borderWidth: 0,
    borderRadius: staticTokens.borderRadius.xl,
    ...staticTokens.shadows.none,
  }),
  getGlassCardPrimaryStyle: (intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light') => ({
    backgroundColor: staticTokens.glassmorphism.cardBackground.dark[intensity],
    borderWidth: 1,
    borderColor: staticTokens.glassmorphism.primaryBorder[intensity],
    borderRadius: staticTokens.borderRadius.xl,
    ...staticTokens.glassmorphism.shadow,
  }),
};

export default DesignTokens;
