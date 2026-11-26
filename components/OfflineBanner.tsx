import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkState } from 'expo-network';
import { TEXT_DIR } from '../lib/i18n/language';

/**
 * באנר גלובלי «אין חיבור לאינטרנט» — יורד מלמעלה כשהרשת נופלת, ועולה עם «החיבור חזר» לרגע כשחוזרת.
 * לא חוסם לחיצות על המסך.
 */
export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const net = useNetworkState();
  // isInternetReachable יכול להיות undefined בהתחלה — רק false מפורש נחשב «אין חיבור»
  const offline = net.isConnected === false || net.isInternetReachable === false;
  const [label, setLabel] = useState<'offline' | 'back' | null>(null);
  const wasOffline = useRef(false);
  const shown = useSharedValue(0);

  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
      setLabel('offline');
      shown.value = withTiming(1, { duration: 220 });
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setLabel('back');
    const t = setTimeout(() => {
      shown.value = withTiming(0, { duration: 220 });
    }, 1500);
    return () => clearTimeout(t);
  }, [offline, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (shown.value - 1) * 40 }],
  }));

  if (!label) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + 6 }, label === 'back' ? styles.back : styles.off, style]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>{label === 'offline' ? 'אין חיבור לאינטרנט' : 'החיבור חזר'}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  off: { backgroundColor: '#3A3A3C' },
  back: { backgroundColor: '#1F7A3A' },
  text: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', writingDirection: TEXT_DIR },
});
