import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** גרדיאנט אנכי רגיל (ירוק־שחור) — בלי שכבת וינייט אלכסונית שדכאה את הצבע */
const SCREEN_GRADIENT_COLORS = [
  '#0A0E0A',
  '#0D140D',
  '#0F1A0F',
  '#142014',
  '#0F1A0F',
  '#0A0E0A',
] as const;
const SCREEN_GRADIENT_LOCATIONS = [0, 0.22, 0.42, 0.55, 0.78, 1] as const;
const SCREEN_GRADIENT_START = { x: 0.5, y: 0 } as const;
const SCREEN_GRADIENT_END = { x: 0.5, y: 1 } as const;

export function AnimatedBackground() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <LinearGradient
        colors={[...SCREEN_GRADIENT_COLORS]}
        locations={[...SCREEN_GRADIENT_LOCATIONS]}
        start={SCREEN_GRADIENT_START}
        end={SCREEN_GRADIENT_END}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

export function ScreenGradientBackground({ style }: { style?: object }) {
  return (
    <View style={[StyleSheet.absoluteFillObject, style]} pointerEvents="none">
      <LinearGradient
        colors={[...SCREEN_GRADIENT_COLORS]}
        locations={[...SCREEN_GRADIENT_LOCATIONS]}
        start={SCREEN_GRADIENT_START}
        end={SCREEN_GRADIENT_END}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

export function withVideoBackground<P extends object>(
  ScreenComponent: React.ComponentType<P>
): React.FC<P> {
  return function WrappedScreen(props: P) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0E0A' }}>
        <AnimatedBackground />
        <ScreenComponent {...props} />
      </View>
    );
  };
}
