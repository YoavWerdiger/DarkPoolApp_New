import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from './DesignTokens';
import { APP_TYPE, appSheetButtonLabelStyle } from './appType';
import { APP_LAYOUT, UI_CARD_RADIUS } from './appLayout';
import { HapticFeedback } from '../../utils/hapticFeedback';

export type InlineDialogButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress: () => void;
  loading?: boolean;
};

/**
 * הדיאלוג של האפליקציה (אותו מראה כמו UIAlert) — אבל בתוך העץ ולא Modal נפרד.
 * למסכים שהם בעצמם Modal (סטורי) — Modal מקונן נפתח שם מתחת למסך.
 * busy = ספינר במקום אייקון ובלי כפתורים (למשל «מעלה סטטוס…»).
 */
export function InlineAppDialog({
  visible,
  title,
  message,
  icon = 'information-circle',
  busy = false,
  buttons = [],
  onBackdropPress,
}: {
  visible: boolean;
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  busy?: boolean;
  buttons?: InlineDialogButton[];
  onBackdropPress?: () => void;
}) {
  const tokens = useDesignTokens();
  const { colors, spacing, borderRadius } = tokens;
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.min(340, Math.max(260, windowWidth - spacing.lg * 2));
  const copyWidth = cardWidth - APP_LAYOUT.cardPadding * 2;
  const scale = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.92);
    fade.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [visible, scale, fade]);

  if (!visible) return null;

  const centered: TextStyle = { width: copyWidth, textAlign: 'center', writingDirection: 'rtl' };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents="box-none">
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.background.overlayHeavy }]}
        onPress={onBackdropPress}
      />
      <View style={[StyleSheet.absoluteFill, styles.center, { padding: spacing.lg }]} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            {
              width: cardWidth,
              backgroundColor: colors.background.primary,
              borderRadius: UI_CARD_RADIUS,
              padding: APP_LAYOUT.cardPadding,
              transform: [{ scale }],
            },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.background.secondary, marginBottom: spacing.lg }]}>
            {busy ? (
              <ActivityIndicator color={colors.primary.main} />
            ) : (
              <Ionicons name={icon} size={32} color={colors.text.secondary} />
            )}
          </View>
          <Text
            style={[
              APP_TYPE.sectionTitle,
              centered,
              { color: colors.text.primary, marginBottom: message ? APP_LAYOUT.cardTitleToBodyGap : 0 },
            ]}
          >
            {title}
          </Text>
          {message ? (
            <Text
              style={[
                APP_TYPE.body,
                centered,
                // בלי כפתורים (למשל העלאה) — מרווח קטן מתחת לטקסט כדי שלא ייצמד לתחתית הכרטיס
                { color: colors.text.secondary, marginBottom: buttons.length ? spacing.lg : spacing.sm },
              ]}
            >
              {message}
            </Text>
          ) : null}
          {buttons.length ? (
            <View style={[styles.buttons, { marginTop: spacing.xs, gap: APP_LAYOUT.cardStackGap }]}>
              {buttons.map((b) => (
                <View
                  key={b.text}
                  style={[styles.btn, { borderRadius: borderRadius.full, backgroundColor: colors.background.cardSolid }]}
                >
                  <Pressable
                    disabled={b.loading}
                    onPress={() => {
                      if (b.style === 'destructive') void HapticFeedback.warning();
                      else void HapticFeedback.selection();
                      b.onPress();
                    }}
                    style={({ pressed }) => [{ width: '100%', opacity: pressed ? 0.85 : 1 }]}
                  >
                    <View style={styles.btnInner}>
                      {b.loading ? (
                        <ActivityIndicator color={b.style === 'destructive' ? colors.text.danger : colors.text.primary} />
                      ) : (
                        <Text
                          style={[
                            appSheetButtonLabelStyle,
                            {
                              textAlign: 'center',
                              color: b.style === 'destructive' ? colors.text.danger : colors.text.primary,
                            },
                          ]}
                        >
                          {b.text}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 100,
    elevation: 100,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // כמו UIAlert: row-reverse ב-ltr — הכפתור הראשון (פעולה) מימין
  buttons: {
    flexDirection: 'row-reverse',
    direction: 'ltr',
    alignSelf: 'stretch',
  },
  btn: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    overflow: 'hidden',
  },
  btnInner: {
    width: '100%',
    minHeight: 52,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default InlineAppDialog;
