import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HapticFeedback } from '../../utils/hapticFeedback';
import UICard from '../ui/UICard';
import DesignTokens from '../ui/DesignTokens';

/** Accent already used by this component for the selected state. */
const SELECTED_ACCENT = '#00D26A';

interface OnboardingChoiceRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Allow tapping a selected row again to clear (useful for optional questions) */
  allowDeselect?: boolean;
  /** Multi-select row: square checkbox indicator, tapping always toggles */
  multiple?: boolean;
}

/**
 * קומפוננטת בחירה מעוצבת לשאלוני onboarding.
 * עיצוב glass מעוגל עם blur effect.
 */
const OnboardingChoiceRow: React.FC<OnboardingChoiceRowProps> = ({
  label,
  selected,
  onPress,
  allowDeselect = false,
  multiple = false,
}) => {
  const handlePress = () => {
    if (selected && !allowDeselect && !multiple) return;
    void HapticFeedback.selection();
    onPress();
  };

  return (
    <UICard
      variant="glass"
      glassIntensity="light"
      padding="none"
      onPress={handlePress}
      pressable
      haptic={false}
      style={{
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: selected ? SELECTED_ACCENT : 'rgba(255, 255, 255, 0.15)',
      }}
      contentContainerStyle={{
        flexDirection: 'row-reverse', // אינדיקטור מימין
        alignItems: 'center',
        padding: 16,
      }}
    >
      {/* Radio (single select) / Checkbox (multi select) */}
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: multiple ? 6 : 10,
          borderWidth: 2,
          borderColor: selected ? SELECTED_ACCENT : 'rgba(255, 255, 255, 0.3)',
          backgroundColor: selected
            ? multiple
              ? SELECTED_ACCENT
              : 'rgba(0, 210, 106, 0.15)'
            : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected &&
          (multiple ? (
            <Ionicons
              name="checkmark"
              size={14}
              color={DesignTokens.colors.background.primary}
            />
          ) : (
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: SELECTED_ACCENT,
              }}
            />
          ))}
      </View>

      {/* Label Text */}
      <Text
        style={{
          flex: 1,
          marginRight: 12, // ריווח מהאינדיקטור
          fontSize: 16,
          lineHeight: 22,
          color: '#FFFFFF',
          textAlign: 'right', // יישור ימינה
          fontWeight: selected ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </UICard>
  );
};

/**
 * קונטיינר פשוט לרשימת אופציות בחירה.
 */
export const OnboardingChoiceGroup: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <View style={{ gap: 10 }}>{children}</View>;

export default OnboardingChoiceRow;
