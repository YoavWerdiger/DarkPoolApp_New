/**
 * רקע מסך כמו מערכת הצ'אט: אורורה ירוקה-כהה מ-Figma Make.
 * משותף ל־ChatScreenShell, פרופיל, אדמין ומסכי יומן.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { ScreenGradientBackground } from '../VideoBackground';

export function ChatSessionBackdrop({ local = false }: { local?: boolean }) {
  return <ScreenGradientBackground style={StyleSheet.absoluteFill} animated={!local} />;
}
