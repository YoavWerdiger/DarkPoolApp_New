import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useDesignTokens } from '../ui/DesignTokens';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';

/**
 * כפתור תפריט ראשי (מגירה) — רק בדף הפרופיל הראשי; רטט בלחיצה.
 */
export function ProfileDrawerMenuBar() {
  const DesignTokens = useDesignTokens();
  const navigation = useNavigation();

  const openMainDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

  return (
    <View
      style={[
        styles.row,
        {
          paddingHorizontal: DesignTokens.spacing.lg,
          paddingTop: DesignTokens.spacing.xs,
          paddingBottom: DesignTokens.spacing.sm,
        },
      ]}
    >
      <DayNavBlurButton
        onPress={openMainDrawer}
        glassIntensity="subtle"
        size={DRAWER_MENU_BUTTON_SIZE}
        accessibilityLabel="תפריט ראשי"
      >
        <Ionicons name="menu" size={24} color={DesignTokens.colors.text.primary} />
      </DayNavBlurButton>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 52,
  },
});
