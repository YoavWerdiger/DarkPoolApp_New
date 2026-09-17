/**
 * רקע מסך כמו מערכת הצ'אט: גרדיאנט מלא (~70% שחור).
 * משותף ל־ChatScreenShell, פרופיל, אדמין ומסכי יומן.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { ScreenGradientBackground } from '../VideoBackground';

export function ChatSessionBackdrop() {
  return <ScreenGradientBackground style={StyleSheet.absoluteFill} />;
}
