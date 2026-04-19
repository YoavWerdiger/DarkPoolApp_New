import React, { useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useDesignTokens } from '../ui/DesignTokens';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';

const BTN = 46;

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
      <TouchableOpacity
        onPress={openMainDrawer}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="תפריט ראשי"
        style={[
          styles.btn,
          {
            backgroundColor: DesignTokens.colors.background.secondary,
            borderColor: DesignTokens.colors.border.strong,
          },
        ]}
      >
        <Ionicons name="menu" size={28} color={DesignTokens.colors.text.primary} />
      </TouchableOpacity>
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
  btn: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
