import React from 'react';
import { useTheme } from '../../context/ThemeContext';

// Dark Theme — DarkPool green-black identity
const darkColors = {
  primary: {
    main: '#00C805',
    dark: '#00A004',
    darker: '#008F03',
    light: '#33D43B',
    lighter: '#5CFF5C',
    dim: 'rgba(0, 200, 5, 0.12)',
    glow: 'rgba(0, 200, 5, 0.35)',
    subtle: 'rgba(0, 200, 5, 0.06)',
    gradient: ['#00C805', '#00A004'],
  },
  secondary: {
    main: '#34D399',
    dark: '#10B981',
    light: '#6EE7B7',
  },
  accent: {
    main: '#3B82F6',
    dark: '#2563EB',
    light: '#60A5FA',
  },

  background: {
    primary: '#0A0E0A',
    secondary: '#0F1A0F',
    tertiary: '#142014',
    elevated: '#1A2B1A',
    elevated2: '#1A2B1A',
    card: 'rgba(255, 255, 255, 0.05)',
    cardHover: 'rgba(255, 255, 255, 0.08)',
    cardSolid: '#141F14',
    surface: 'rgba(255, 255, 255, 0.03)',
    input: 'rgba(255, 255, 255, 0.06)',
    header: 'rgba(15, 26, 15, 0.85)',
    tabBar: 'rgba(10, 14, 10, 0.95)',
    tabActive: '#00C805',
    sheet: '#121E12',
    overlay: 'rgba(0, 0, 0, 0.60)',
    overlayHeavy: 'rgba(0, 0, 0, 0.85)',
  },

  bubbleMe: '#00C805',
  bubbleOther: 'rgba(255, 255, 255, 0.08)',

  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.70)',
    tertiary: 'rgba(255, 255, 255, 0.45)',
    muted: 'rgba(255, 255, 255, 0.30)',
    disabled: 'rgba(255, 255, 255, 0.30)',
    inverse: '#0A0E0A',
    accent: '#00C805',
    danger: '#FF4444',
    success: '#00C805',
    warning: '#FFB800',
    info: '#3B82F6',
  },

  selection: {
    subtle: 'rgba(255, 255, 255, 0.08)',
  },

  border: {
    main: 'rgba(255, 255, 255, 0.08)',
    default: 'rgba(255, 255, 255, 0.08)',
    primary: 'rgba(255, 255, 255, 0.08)',
    subtle: 'rgba(255, 255, 255, 0.04)',
    strong: 'rgba(255, 255, 255, 0.15)',
    accent: 'rgba(0, 200, 5, 0.30)',
    active: 'rgba(0, 200, 5, 0.30)',
    danger: 'rgba(255, 68, 68, 0.30)',
    hover: 'rgba(255, 255, 255, 0.15)',
    divider: 'rgba(255, 255, 255, 0.06)',
  },

  glass: {
    card: {
      bg: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.08)',
    },
    cardElevated: {
      bg: 'rgba(255, 255, 255, 0.08)',
      border: 'rgba(255, 255, 255, 0.10)',
    },
    sheet: {
      bg: 'rgba(18, 30, 18, 0.97)',
      border: 'rgba(255, 255, 255, 0.08)',
    },
    header: {
      bg: 'rgba(15, 26, 15, 0.85)',
      border: 'rgba(255, 255, 255, 0.06)',
    },
    tabBar: {
      bg: 'rgba(10, 14, 10, 0.95)',
      border: 'rgba(255, 255, 255, 0.06)',
    },
  },
};

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
    primary: '#F5F5F7',
    secondary: '#FFFFFF',
    tertiary: '#E8E8ED',
    elevated: '#FFFFFF',
    elevated2: '#FAFAFA',
    card: 'rgba(0, 0, 0, 0.03)',
    cardHover: 'rgba(0, 0, 0, 0.05)',
    cardSolid: '#F2F2F7',
    surface: 'rgba(0, 0, 0, 0.02)',
    input: 'rgba(0, 0, 0, 0.04)',
    header: 'rgba(245, 245, 247, 0.85)',
    tabBar: 'rgba(245, 245, 247, 0.95)',
    tabActive: '#00B84A',
    sheet: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.50)',
    overlayHeavy: 'rgba(0, 0, 0, 0.70)',
  },

  bubbleMe: '#DCF8C6',
  bubbleOther: '#FFFFFF',

  text: {
    primary: '#000000',
    secondary: 'rgba(0, 0, 0, 0.65)',
    tertiary: 'rgba(0, 0, 0, 0.45)',
    muted: 'rgba(0, 0, 0, 0.30)',
    disabled: 'rgba(0, 0, 0, 0.30)',
    inverse: '#FFFFFF',
    accent: '#00B84A',
    danger: '#DC2626',
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
    danger: 'rgba(220, 38, 38, 0.30)',
    hover: 'rgba(0, 0, 0, 0.15)',
    divider: 'rgba(0, 0, 0, 0.06)',
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
      bg: 'rgba(245, 245, 247, 0.85)',
      border: 'rgba(0, 0, 0, 0.06)',
    },
    tabBar: {
      bg: 'rgba(245, 245, 247, 0.95)',
      border: 'rgba(0, 0, 0, 0.06)',
    },
  },
};

// Static semantic colors (theme-independent)
const staticColors = {
  success: { main: '#00C805' },
  warning: { main: '#FFB800' },
  danger: { main: '#FF4444' },
  info: { main: '#3B82F6' },
  overlay: 'rgba(0,0,0,0.6)',
  backdrop: 'rgba(0,0,0,0.4)',
};

// Static tokens (theme-independent)
const staticTokens = {
  typography: {
    fontFamily: {
      system: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      assistant: ['Assistant-ExtraBold', 'Assistant', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      mono: ['SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'monospace'],
    },
    fontSize: {
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
    display: { size: 40, weight: '900' as const, letterSpacing: -1.5, lineHeight: 46 },
    heroTitle: { size: 34, weight: '800' as const, letterSpacing: -1.0, lineHeight: 40 },
    title: { size: 28, weight: '700' as const, letterSpacing: -0.5, lineHeight: 34 },
    title2: { size: 22, weight: '700' as const, letterSpacing: -0.3, lineHeight: 28 },
    subtitle: { size: 18, weight: '600' as const, letterSpacing: 0, lineHeight: 24 },
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
    },
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
  },

  borderRadius: {
    none: 0,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    full: 9999,
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
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 3,
    },
    green: {
      shadowColor: '#00C805',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    greenGlow: {
      shadowColor: '#00C805',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
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
    screenPadding: 20,
    cardPadding: 16,
    sectionGap: 24,
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
    primary: ['#00C805', '#00A004'],
    primaryVertical: ['#00C805', '#00A004'],
    primaryHorizontal: ['#00C805', '#00A004'],
    dark: ['#0A0E0A', '#0F1A0F'],
    overlay: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)'],
    card: ['rgba(0, 200, 5, 0.06)', 'rgba(0, 200, 5, 0.02)'],
    screen: ['#0A0E0A', '#0D140D', '#0F1A0F', '#142014', '#0F1A0F', '#0A0E0A'],
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
        shadowColor: '#00C805',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
      },
    },
  },

  glassmorphism: {
    blurIntensity: {
      subtle: 20,
      light: 24,
      medium: 30,
      strong: 40,
    },
    blurTint: {
      dark: 'systemChromeMaterialDark' as const,
      light: 'systemChromeMaterialLight' as const,
      default: 'systemChromeMaterialDark' as const,
    },
    cardBackground: {
      dark: {
        subtle: 'rgba(255, 255, 255, 0.03)',
        light: 'rgba(255, 255, 255, 0.05)',
        medium: 'rgba(255, 255, 255, 0.08)',
        strong: 'rgba(255, 255, 255, 0.12)',
      },
      light: {
        subtle: 'rgba(255, 255, 255, 0.40)',
        light: 'rgba(255, 255, 255, 0.55)',
        medium: 'rgba(255, 255, 255, 0.70)',
        strong: 'rgba(255, 255, 255, 0.85)',
      },
    },
    border: {
      dark: {
        subtle: 'rgba(255, 255, 255, 0.04)',
        light: 'rgba(255, 255, 255, 0.08)',
        medium: 'rgba(255, 255, 255, 0.10)',
        strong: 'rgba(255, 255, 255, 0.15)',
      },
      light: {
        subtle: 'rgba(0, 0, 0, 0.04)',
        light: 'rgba(0, 0, 0, 0.08)',
        medium: 'rgba(0, 0, 0, 0.10)',
        strong: 'rgba(0, 0, 0, 0.15)',
      },
    },
    topHighlight: {
      dark: {
        subtle: 'rgba(255, 255, 255, 0.06)',
        light: 'rgba(255, 255, 255, 0.10)',
        medium: 'rgba(255, 255, 255, 0.14)',
        strong: 'rgba(255, 255, 255, 0.20)',
      },
      light: {
        subtle: 'rgba(255, 255, 255, 0.30)',
        light: 'rgba(255, 255, 255, 0.50)',
        medium: 'rgba(255, 255, 255, 0.70)',
        strong: 'rgba(255, 255, 255, 0.90)',
      },
    },
    primaryBorder: {
      subtle: 'rgba(0, 200, 5, 0.10)',
      light: 'rgba(0, 200, 5, 0.20)',
      medium: 'rgba(0, 200, 5, 0.30)',
      strong: 'rgba(0, 200, 5, 0.45)',
    },
    shadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 8,
    },
  },
};

// Dynamic hook — returns tokens matching current theme
export const useDesignTokens = () => {
  try {
    const { isDarkMode } = useTheme();
    const themeColors = isDarkMode ? darkColors : lightColors;

    return React.useMemo(() => {
      const glassmorphism = staticTokens.glassmorphism;

      const tokens = {
        colors: {
          ...themeColors,
          ...staticColors,
        },
        ...staticTokens,
        getGlassCardStyle: (intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light') => ({
          backgroundColor: isDarkMode
            ? glassmorphism.cardBackground.dark[intensity]
            : glassmorphism.cardBackground.light[intensity],
          borderWidth: 0.5,
          borderColor: isDarkMode
            ? glassmorphism.border.dark[intensity]
            : glassmorphism.border.light[intensity],
          borderTopColor: isDarkMode
            ? glassmorphism.topHighlight.dark[intensity]
            : glassmorphism.topHighlight.light[intensity],
          borderRadius: staticTokens.borderRadius.xl,
          ...glassmorphism.shadow,
        }),
        getGlassCardPrimaryStyle: (intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light') => ({
          backgroundColor: isDarkMode
            ? glassmorphism.cardBackground.dark[intensity]
            : glassmorphism.cardBackground.light[intensity],
          borderWidth: 1,
          borderColor: glassmorphism.primaryBorder[intensity],
          borderRadius: staticTokens.borderRadius.xl,
          ...glassmorphism.shadow,
        }),
      };

      return tokens;
    }, [isDarkMode]);
  } catch (error) {
    const glassmorphism = staticTokens.glassmorphism;
    return {
      colors: {
        ...darkColors,
        ...staticColors,
      },
      ...staticTokens,
      getGlassCardStyle: (intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light') => ({
        backgroundColor: glassmorphism.cardBackground.dark[intensity],
        borderWidth: 0.5,
        borderColor: glassmorphism.border.dark[intensity],
        borderTopColor: glassmorphism.topHighlight.dark[intensity],
        borderRadius: staticTokens.borderRadius.xl,
        ...glassmorphism.shadow,
      }),
      getGlassCardPrimaryStyle: (intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light') => ({
        backgroundColor: glassmorphism.cardBackground.dark[intensity],
        borderWidth: 1,
        borderColor: glassmorphism.primaryBorder[intensity],
        borderRadius: staticTokens.borderRadius.xl,
        ...glassmorphism.shadow,
      }),
    };
  }
};

// Static export for backward compatibility (defaults to dark theme)
export const DesignTokens = {
  colors: {
    ...darkColors,
    ...staticColors,
  },
  ...staticTokens,
  getGlassCardStyle: (intensity: 'subtle' | 'light' | 'medium' | 'strong' = 'light') => ({
    backgroundColor: staticTokens.glassmorphism.cardBackground.dark[intensity],
    borderWidth: 0.5,
    borderColor: staticTokens.glassmorphism.border.dark[intensity],
    borderTopColor: staticTokens.glassmorphism.topHighlight.dark[intensity],
    borderRadius: staticTokens.borderRadius.xl,
    ...staticTokens.glassmorphism.shadow,
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
