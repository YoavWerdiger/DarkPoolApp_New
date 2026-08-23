import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
  label: string;
  color: string;
};

export function AdminBadge({ label, color }: Props) {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${color}18`,
          borderColor: `${color}40`,
        },
      ]}
    >
      <Text style={{ color, fontSize: 10, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
});
