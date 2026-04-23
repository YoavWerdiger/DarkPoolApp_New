import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from './DesignTokens';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const tokens = useDesignTokens();
  const { colors, borderRadius, typography, spacing } = tokens;
  const glass = tokens.getGlassCardStyle('light');
  const translateY = useRef(new Animated.Value(48)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const typeConfig: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    success: { icon: 'checkmark-circle', color: colors.success.main },
    error: { icon: 'alert-circle', color: colors.danger.main },
    info: { icon: 'information-circle', color: colors.info.main },
    warning: { icon: 'warning', color: colors.warning.main },
  };

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 78, friction: 11 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 56, duration: 240, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start(() => onDismiss(toast.id));
    }, toast.duration || 3500);

    return () => clearTimeout(timer);
  }, []);

  const config = typeConfig[toast.type];

  return (
    <Animated.View
      style={[
        glass,
        {
          flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          paddingLeft: spacing.base,
          paddingRight: spacing.md,
          paddingVertical: spacing.md,
          borderRadius: borderRadius.xl,
          borderColor: `${config.color}40`,
          borderWidth: 1,
          maxWidth: '100%',
          gap: spacing.md,
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16 },
            android: { elevation: 12 },
          }),
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Ionicons name={config.icon} size={22} color={config.color} />
      <Text
        style={{
          flex: 1,
          color: colors.text.primary,
          fontSize: typography.body.size,
          fontWeight: typography.bodySemiBold.weight as '600',
          lineHeight: typography.body.lineHeight,
          textAlign: I18nManager.isRTL ? 'right' : 'left',
          writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
        }}
        numberOfLines={4}
      >
        {toast.message}
      </Text>
      <TouchableOpacity
        onPress={() => onDismiss(toast.id)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ padding: spacing.xs }}
      >
        <Ionicons name="close" size={20} color={colors.text.tertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + 12;

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    setToasts(prev => [...prev.slice(-2), { id, message, type, duration }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={[styles.container, { bottom: bottomPad }]} pointerEvents="box-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast: (_message: string, _type?: ToastType, _duration?: number) => {
        if (__DEV__) console.warn('useToast called outside ToastProvider');
      },
    };
  }
  return context;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10000,
    alignItems: 'stretch',
    gap: 10,
  },
});
