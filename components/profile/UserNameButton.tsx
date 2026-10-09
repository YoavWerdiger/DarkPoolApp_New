import React, { useCallback } from 'react';
import { Pressable, Text, type TextStyle } from 'react-native';

type Props = {
  userId?: string;
  name: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
};

export default function UserNameButton({
  userId,
  name,
  onPress,
  disabled = false,
  style,
  numberOfLines,
}: Props) {

  // בלי פרופיל ציבורי — לחיץ רק כשהקורא מעביר onPress
  const handlePress = useCallback(() => {
    onPress?.();
  }, [onPress]);

  const canPress = !disabled && !!onPress;
  if (!canPress) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {name}
      </Text>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`פרופיל של ${name}`}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
    >
      <Text style={style} numberOfLines={numberOfLines}>
        {name}
      </Text>
    </Pressable>
  );
}
