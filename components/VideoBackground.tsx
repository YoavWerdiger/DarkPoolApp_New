import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** Soft UI — רקע מסך אחיד #111111 (ניסוי dark soft) */
const SCREEN_GRADIENT_COLORS = [
  '#111111',
  '#111111',
  '#181818',
  '#111111',
  '#111111',
  '#111111',
] as const;
const SCREEN_GRADIENT_LOCATIONS = [0, 0.16, 0.36, 0.50, 0.74, 1] as const;
const SCREEN_GRADIENT_START = { x: 0.5, y: 0 } as const;
const SCREEN_GRADIENT_END = { x: 0.5, y: 1 } as const;

export function AnimatedBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[...SCREEN_GRADIENT_COLORS]}
        locations={[...SCREEN_GRADIENT_LOCATIONS]}
        start={SCREEN_GRADIENT_START}
        end={SCREEN_GRADIENT_END}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export function ScreenGradientBackground({ style }: { style?: object }) {
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <LinearGradient
        colors={[...SCREEN_GRADIENT_COLORS]}
        locations={[...SCREEN_GRADIENT_LOCATIONS]}
        start={SCREEN_GRADIENT_START}
        end={SCREEN_GRADIENT_END}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export function withVideoBackground<P extends object>(
  ScreenComponent: React.ComponentType<P>
): React.FC<P> {
  return function WrappedScreen(props: P) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111111' }}>
        <AnimatedBackground />
        <ScreenComponent {...props} />
      </View>
    );
  };
}
