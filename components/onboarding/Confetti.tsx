import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

type Piece = {
  x: number;
  drift: number;
  rotate: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  round: boolean;
};

/**
 * פיצוץ קונפטי חד-פעמי — חלקים יוצאים ממרכז-עליון ונופלים עם סיבוב.
 * Animated של RN עם useNativeDriver (חלק גם כשה-JS עסוק).
 */
export function Confetti({
  fire,
  colors,
  count = 46,
}: {
  fire: boolean;
  colors: string[];
  count?: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        x: W / 2 + (Math.random() - 0.5) * 60,
        drift: (Math.random() - 0.5) * W * 1.1,
        rotate: (Math.random() - 0.5) * 900,
        delay: Math.random() * 0.12,
        duration: 0.75 + Math.random() * 0.25,
        size: 6 + Math.random() * 6,
        color: colors[i % colors.length],
        round: Math.random() > 0.6,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count],
  );

  useEffect(() => {
    if (!fire) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 2600,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [fire, progress]);

  if (!fire) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const start = p.delay;
        const end = Math.min(1, p.delay + p.duration);
        const t = progress.interpolate({
          inputRange: [0, start, end, 1],
          outputRange: [0, 0, 1, 1],
          extrapolate: 'clamp',
        });
        // עולה מהר ואז נופל (פרבולה): y = -burst*t + gravity*t²
        const translateY = t.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [0, -H * 0.18, -H * 0.06, H * 0.3, H * 0.75],
        });
        const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] });
        const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotate}deg`] });
        const opacity = t.interpolate({ inputRange: [0, 0.05, 0.8, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: H * 0.28,
              width: p.size,
              height: p.round ? p.size : p.size * 1.8,
              borderRadius: p.round ? p.size / 2 : 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}
