import React from 'react';
import { View } from 'react-native';
import { AuroraHost, GradientBackground } from './ui/GradientBackground';
import { useAuroraHosted } from './ui/DarkGreenAuroraBackground';

export { AuroraHost };

export function AnimatedBackground() {
  return <GradientBackground />;
}

export function ScreenGradientBackground({
  style,
  animated = true,
}: {
  style?: object;
  animated?: boolean;
}) {
  const hosted = useAuroraHosted();
  // שורש האפליקציה כבר מצייר; שיט/ייצוא (animated=false) חייבים ציור מקומי.
  if (hosted && animated) return null;
  return <GradientBackground style={style} animated={animated} />;
}

export function withVideoBackground<P extends object>(
  ScreenComponent: React.ComponentType<P>
): React.FC<P> {
  return function WrappedScreen(props: P) {
    const hosted = useAuroraHosted();
    return (
      <View style={{ flex: 1, backgroundColor: hosted ? 'transparent' : '#000000' }}>
        {hosted ? null : <AnimatedBackground />}
        <ScreenComponent {...props} />
      </View>
    );
  };
}
