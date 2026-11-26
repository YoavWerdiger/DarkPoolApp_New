import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import i18n from '../lib/i18n';
import { TEXT_DIR } from '../lib/i18n/language';
import { useDesignTokens } from './ui/DesignTokens';
import { logger } from '../utils/logger';

const TAG = 'ota';
/** Don't ask the update server more than once in this window when the app comes back to the foreground */
const MIN_CHECK_GAP_MS = 10 * 60 * 1000;

/**
 * OTA updates without the store: on launch and whenever the app returns to the foreground, check
 * the update server, download a new JS bundle in the background, then offer a one-tap restart.
 * (Without this, a downloaded update only applies on the *next* cold start.)
 * Does nothing in Expo Go / dev, where expo-updates is disabled.
 */
export default function OtaUpdateBanner() {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const busy = useRef(false);
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled || busy.current || ready) return;
    if (Date.now() - lastCheck.current < MIN_CHECK_GAP_MS) return;
    busy.current = true;
    lastCheck.current = Date.now();
    try {
      const res = await Updates.checkForUpdateAsync();
      if (!res.isAvailable) return;
      const fetched = await Updates.fetchUpdateAsync();
      if (fetched.isNew) setReady(true);
    } catch (e) {
      // Offline / server hiccup — try again on the next foreground
      logger.warn(TAG, 'update check failed', e);
    } finally {
      busy.current = false;
    }
  }, [ready]);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  if (!ready) return null;
  const { colors } = tokens;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 12 }]}>
      <View style={[styles.bar, { backgroundColor: colors.background.elevated, borderColor: colors.border.divider }]}>
        <Text style={[styles.text, { color: colors.text.primary }]} numberOfLines={2}>
          {i18n.t('auto.components__OtaUpdateBanner.ready')}
        </Text>
        <Pressable
          onPress={() => void Updates.reloadAsync()}
          hitSlop={8}
          style={({ pressed }) => [styles.btn, { backgroundColor: colors.text.accent, opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
        >
          <Text style={[styles.btnText, { color: colors.text.inverse }]}>{i18n.t('auto.components__OtaUpdateBanner.restart')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 1000 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingStart: 16,
    paddingEnd: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  text: { flex: 1, fontSize: 14, fontWeight: '500', textAlign: 'right', writingDirection: TEXT_DIR },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  btnText: { fontSize: 14, fontWeight: '600' },
});
