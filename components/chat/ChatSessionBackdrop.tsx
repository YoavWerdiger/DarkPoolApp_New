/**
 * רקע מסך כמו מערכת הצ'אט: גרדיאנט DarkPool + שכבת transback (שור ודוב).
 * משותף ל־ChatScreenShell ולמסכי פרופיל.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { ScreenGradientBackground } from '../VideoBackground';
import { BrandTransbackWatermark } from '../ui/BrandTransbackWatermark';

export function ChatSessionBackdrop() {
  return (
    <>
      <ScreenGradientBackground style={StyleSheet.absoluteFillObject} />
      <BrandTransbackWatermark />
    </>
  );
}
