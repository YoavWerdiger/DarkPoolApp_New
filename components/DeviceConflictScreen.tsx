import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from './ui/DesignTokens';
import UIButton from './ui/UIButton';
import { APP_LAYOUT } from './ui/appLayout';
import { APP_TYPE } from './ui/appType';

type Props = {
  /** «התחבר מכאן» — המכשיר הזה הופך לפעיל, האחר מתנתק */
  onConnectHere: () => Promise<void> | void;
  /** «התנתק» — יציאה מהמכשיר הזה */
  onSignOut: () => void;
};

/**
 * מסך מלא כשהחשבון פעיל במכשיר אחר (מכשיר אחד לכל משתמש).
 * בצבע הקנבס של הערכה, כמו מסכי ה-flow.
 */
export function DeviceConflictScreen({ onConnectHere, onSignOut }: Props) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

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
          החשבון מחובר במכשיר אחר
        </Text>
        <Text style={[styles.body, { color: tokens.colors.text.secondary }]}>
          אפשר להשתמש בחשבון במכשיר אחד בכל פעם. אם תתחבר מכאן — החשבון יתנתק במכשיר השני.
        </Text>
      </View>

      <View style={styles.actions}>
        <UIButton
          title="התחבר מכאן"
          variant="primary"
          size="lg"
          fullWidth
          loading={busy}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await onConnectHere();
            } finally {
              setBusy(false);
            }
          }}
        />
        <UIButton
          title="התנתק"
          variant="secondary"
          fullWidth
          disabled={busy}
          onPress={onSignOut}
          style={{ borderRadius: 999, backgroundColor: tokens.colors.background.cardSolid }}
        />
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
