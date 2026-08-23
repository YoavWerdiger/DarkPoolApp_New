import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { DesignTokens } from '../ui/DesignTokens';

/** באנר שגיאה בסגנון כפתור ההתנתקות (outline danger pill). */
const OnboardingErrorBanner = ({
  message,
  style,
}: {
  message: string;
  style?: ViewStyle;
}) => {
  if (!message) return null;

  return (
    <View style={[styles.banner, style]}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: DesignTokens.spacing.md,
    paddingHorizontal: DesignTokens.spacing.xl,
    marginBottom: DesignTokens.spacing.xl,
    borderRadius: DesignTokens.borderRadius.full,
    overflow: 'hidden',
    backgroundColor: `${DesignTokens.colors.danger.main}1A`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${DesignTokens.colors.danger.main}55`,
  },
  text: {
    fontSize: DesignTokens.typography.body.size,
    fontWeight: DesignTokens.typography.buttonSmall.weight as any,
    lineHeight: DesignTokens.typography.body.lineHeight,
    color: DesignTokens.colors.danger.main,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});

export default OnboardingErrorBanner;
