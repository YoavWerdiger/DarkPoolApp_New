import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import i18n from '../../lib/i18n';
import { ErrorBoundary } from '../ErrorBoundary';

/**
 * רשת ביטחון למסכי הסטוריז (צפייה + יצירה): שגיאת רינדור לא מקריסה את האפליקציה בפרודקשן —
 * מסך שחור עם הודעה וכפתור סגירה שחוזר אחורה.
 */
export function StoryErrorFallback({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Ionicons name="alert-circle-outline" size={44} color="rgba(255,255,255,0.45)" />
      <Text style={styles.title}>{i18n.t('common.error')}</Text>
      <Pressable onPress={onClose} style={styles.btn} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.btnText}>{i18n.t('common.close')}</Text>
      </Pressable>
    </View>
  );
}

export function StoryErrorBoundary({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return <ErrorBoundary fallback={<StoryErrorFallback onClose={onClose} />}>{children}</ErrorBoundary>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 14 },
  title: { color: 'rgba(255,255,255,0.8)', fontSize: 17, fontWeight: '600' },
  btn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
