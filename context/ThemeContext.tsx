import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureRef } from 'react-native-view-shot';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SoftUI } from '../components/ui/softUiPalette';
import { LIGHT_CANVAS, LIGHT_CARD, LIGHT_TEXT_PRIMARY } from '../components/ui/designTokensStatic';

/** הצלבה בין שני מראות — בלי לוח צבע אטום. */
const THEME_BLEND_MS = 260;

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
  const [overlayUri, setOverlayUri] = useState<string | null>(null);
  const [blendEpoch, setBlendEpoch] = useState(0);
  const shellRef = useRef<View>(null);
  const toggleLock = useRef(false);
  const ignoreHydrate = useRef(false);
  const mounted = useRef(true);
  const pendingNext = useRef<boolean | null>(null);
  const blendArmed = useRef(false);
  const animatedEpoch = useRef(0);
  const loadFailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (loadFailTimer.current) clearTimeout(loadFailTimer.current);
    };
  }, []);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem('appSettings');
      if (saved && !ignoreHydrate.current) {
        const parsedSettings = JSON.parse(saved);
        setIsDarkMode(parsedSettings.darkMode ?? true);
      }
    } catch (error) {
    }
  };

  const clearLoadFail = useCallback(() => {
    if (loadFailTimer.current) {
      clearTimeout(loadFailTimer.current);
      loadFailTimer.current = null;
    }
  }, []);

  const endBlend = useCallback(() => {
    clearLoadFail();
    pendingNext.current = null;
    blendArmed.current = false;
    toggleLock.current = false;
    setOverlayUri(null);
  }, [clearLoadFail]);

  const failOpen = useCallback(() => {
    const next = pendingNext.current;
    if (next != null) setIsDarkMode(next);
    endBlend();
  }, [endBlend]);

  useLayoutEffect(() => {
    if (blendEpoch === 0 || animatedEpoch.current === blendEpoch) return;
    const next = pendingNext.current;
    if (next == null) return;
    animatedEpoch.current = blendEpoch;
    overlayOpacity.value = 1;
    setIsDarkMode(next);
    // הערכה החדשה צריכה להיות מצוירת מתחת לצילום לפני שהדעיכה מתחילה, אחרת הפריימים הראשונים נתקעים על ה-re-render.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        overlayOpacity.value = withTiming(
          0,
          { duration: THEME_BLEND_MS, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(endBlend)();
          },
        );
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [blendEpoch, endBlend, overlayOpacity]);

  const onOverlayLoad = useCallback(() => {
    if (blendArmed.current) return;
    blendArmed.current = true;
    clearLoadFail();
    setBlendEpoch((epoch) => epoch + 1);
  }, [clearLoadFail]);

  const toggleTheme = useCallback(() => {
    if (toggleLock.current) return;
    toggleLock.current = true;
    ignoreHydrate.current = true;

    const next = !isDarkMode;
    pendingNext.current = next;

    void (async () => {
      try {
        const saved = await AsyncStorage.getItem('appSettings');
        const settings = saved ? JSON.parse(saved) : {};
        await AsyncStorage.setItem('appSettings', JSON.stringify({ ...settings, darkMode: next }));
      } catch (error) {
      }
    })();

    void (async () => {
      let uri: string | null = null;
      try {
        if (shellRef.current) {
          uri = await captureRef(shellRef, {
            format: 'jpg',
            quality: 0.92,
            result: 'tmpfile',
          });
        }
      } catch (error) {
        uri = null;
      }
      if (!mounted.current) return;
      if (!uri) {
        failOpen();
        return;
      }
      overlayOpacity.value = 0;
      setOverlayUri(uri);
      clearLoadFail();
      loadFailTimer.current = setTimeout(() => {
        if (!blendArmed.current) failOpen();
      }, 900);
    })();
  }, [clearLoadFail, failOpen, isDarkMode, overlayOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const backgroundImage = isDarkMode 
    ? `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/backgrounds/1.png`
    : `${process.env.EXPO_PUBLIC_SUPABASE_URL!}/storage/v1/object/public/backgrounds/2.png`;

  const theme = {
    background: isDarkMode ? SoftUI.canvas : LIGHT_CANVAS,
    cardBackground: isDarkMode ? SoftUI.surface1 : LIGHT_CARD,
    textPrimary: isDarkMode ? SoftUI.textPrimary : LIGHT_TEXT_PRIMARY,
    textSecondary: isDarkMode ? SoftUI.textSecondary : 'rgba(0,0,0,0.65)',
    textTertiary: isDarkMode ? SoftUI.textMuted : 'rgba(0,0,0,0.45)',
    border: isDarkMode ? SoftUI.borderSubtle : 'rgba(0,0,0,0.10)',
    headerBorder: isDarkMode ? SoftUI.borderSubtle : 'rgba(0,0,0,0.08)',
    switchTrackOff: isDarkMode ? '#252525' : '#E5E5E7',
    switchThumbOff: isDarkMode ? '#FFFFFF' : '#FFFFFF'
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, backgroundImage, theme }}>
      <View ref={shellRef} collapsable={false} style={styles.shell}>
        {children}
        {overlayUri ? (
          <Animated.View pointerEvents="none" style={[styles.overlay, overlayStyle]}>
            <Image
              source={{ uri: overlayUri }}
              resizeMode="stretch"
              fadeDuration={0}
              accessible={false}
              onLoad={onOverlayLoad}
              onError={failOpen}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
      </View>
    </ThemeContext.Provider>
  );
};

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
  },
});
