import React, { useCallback } from 'react';
import { Pressable, Text, type TextStyle } from 'react-native';
import { openUserProfile } from '../../lib/openUserProfile';

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

  // ברירת מחדל: פותח את הפרופיל הציבורי; קורא יכול להעביר onPress משלו (למשל לסגור שיט קודם)
  const handlePress = useCallback(() => {
    if (onPress) onPress();
    else openUserProfile(userId);
  }, [onPress, userId]);

  const canPress = !disabled && (!!onPress || !!userId);
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
