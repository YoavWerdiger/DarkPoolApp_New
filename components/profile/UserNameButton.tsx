import React, { useCallback } from 'react';
import { Pressable, Text, type TextStyle } from 'react-native';
import { useAuth } from '../../context/AuthContext';
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
  const { user } = useAuth();

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }
    if (userId) {
      openUserProfile(userId, { currentUserId: user?.id });
    }
  }, [onPress, user?.id, userId]);

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
