import React, { useCallback } from 'react';
import { Image, Pressable, Text, View, type ViewStyle } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';

type Props = {
  userId?: string;
  name: string;
  uri: string | null;
  size?: number;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export default function UserAvatarButton({
  userId,
  name,
  uri,
  size = 42,
  onPress,
  disabled = false,
  style,
  accessibilityLabel,
}: Props) {
  const tokens = useDesignTokens();
  const initial = (name.trim()[0] || '?').toUpperCase();

  // בלי פרופיל ציבורי — לחיץ רק כשהקורא מעביר onPress
  const handlePress = useCallback(() => {
    onPress?.();
  }, [onPress]);

  const canPress = !disabled && !!onPress;

  const avatar = uri ? (
    <Image
      source={{ uri }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tokens.colors.background.tertiary,
      }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tokens.colors.primary.dim,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: tokens.colors.primary.main,
          fontWeight: '700',
          fontSize: size * 0.38,
        }}
      >
        {initial}
      </Text>
    </View>
  );

  if (!canPress) {
    return <View style={style}>{avatar}</View>;
  }

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `פרופיל של ${name}`}
      style={({ pressed }) => [style, pressed ? { opacity: 0.85 } : undefined]}
    >
      {avatar}
    </Pressable>
  );
}
