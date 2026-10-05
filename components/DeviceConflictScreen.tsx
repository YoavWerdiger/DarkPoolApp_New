import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from './ui/DesignTokens';
import UIButton from './ui/UIButton';
import { APP_LAYOUT } from './ui/appLayout';
import { APP_TYPE } from './ui/appType';

type Props = {
  /** יציאה מהמכשיר הזה → מסך התחברות. רק התחברות מחדש מחזירה את החשבון לכאן. */
  onSignOut: () => void;
};

/**
 * מסך מלא כשהחשבון נפתח במכשיר אחר (מכשיר אחד לכל משתמש).
 * אין «התחבר מכאן»: מכשיר שנזרק חייב להתחבר מחדש (השרת מסרב לסשן הישן) —
 * כך שני אנשים לא יכולים להתחלף על אותו חשבון בלי סיסמה.
 */
export function DeviceConflictScreen({ onSignOut }: Props) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        { backgroundColor: tokens.colors.background.primary, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) },
      ]}
      accessibilityViewIsModal
    >
      <View style={styles.center}>
        <View style={[styles.iconRing, { backgroundColor: tokens.colors.background.cardSolid }]}>
          <Ionicons name="phone-portrait-outline" size={38} color={tokens.colors.text.primary} />
        </View>
        <Text style={[styles.title, { color: tokens.colors.text.primary }]}>
          התחברת ממכשיר אחר
        </Text>
        <Text style={[styles.body, { color: tokens.colors.text.secondary }]}>
          אפשר להשתמש בחשבון במכשיר אחד בכל פעם, ולכן התנתקת מהמכשיר הזה. כדי להמשיך כאן — התחבר מחדש.
        </Text>
      </View>

      <View style={styles.actions}>
        <UIButton title="התחבר מחדש" variant="primary" size="lg" fullWidth onPress={onSignOut} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 9998,
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: APP_LAYOUT.componentGap,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_LAYOUT.stackGapSmall,
  },
  title: {
    fontSize: APP_TYPE.flowTitle.fontSize,
    lineHeight: APP_TYPE.flowTitle.lineHeight,
    fontWeight: APP_TYPE.flowTitle.fontWeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  body: {
    fontSize: APP_TYPE.sectionSubtitle.fontSize,
    lineHeight: APP_TYPE.sectionSubtitle.lineHeight,
    textAlign: 'center',
    writingDirection: 'rtl',
    paddingHorizontal: 8,
  },
  actions: {
    gap: APP_LAYOUT.stackGapSmall,
  },
});
