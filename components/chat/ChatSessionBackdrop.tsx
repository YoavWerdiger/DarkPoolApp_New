/**
 * רקע מסך כמו מערכת הצ'אט: אורורה ירוקה-כהה מ-Figma Make.
 * במצב בהיר — קנבס בהיר בלבד (בלי אורורה כהה על טוקני דיו כהה).
 * משותף ל־ChatScreenShell, פרופיל, אדמין ומסכי יומן.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { ScreenGradientBackground } from '../VideoBackground';

export function ChatSessionBackdrop({ local = false }: { local?: boolean }) {
  const { isDarkMode, theme } = useTheme();
  if (!isDarkMode) {
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }
  return <ScreenGradientBackground style={StyleSheet.absoluteFill} animated={!local} />;
}
