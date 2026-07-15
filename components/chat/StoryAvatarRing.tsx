// טבעת סטטוס מחולקת לפי מספר הסטוריז (כמו אינסטגרם / וואטסאפ)
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useDesignTokens } from '../ui/DesignTokens';

type Props = {
  size?: number;
  storyCount: number;
  /** false = יש סטטוס שלא נצפה */
  hasViewed?: boolean;
  children: React.ReactNode;
};

const GAP_DEG = 14;

export default function StoryAvatarRing({
  size = 68,
  storyCount,
  hasViewed = false,
  children,
}: Props) {
  const tokens = useDesignTokens();
  const segments = Math.max(1, Math.floor(storyCount) || 1);
  const stroke = 2.75;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const inner = size - stroke * 2 - 3;

  const color = hasViewed
    ? tokens.colors.border.hover
    : tokens.colors.primary.main;

  const arcs = useMemo(() => {
    if (segments === 1) {
      // טבעת מלאה כמעט — פער זעיר ממורכז למעלה (12:00)
      const gapLen = 2;
      const gapDeg = (gapLen / circumference) * 360;
      return [
        {
          dash: `${circumference - gapLen} ${circumference}`,
          rotation: -90 + gapDeg / 2,
        },
      ];
    }

    const gapLen = (GAP_DEG / 360) * circumference;
    const segLen = Math.max(4, (circumference - segments * gapLen) / segments);
    const step = 360 / segments;
    // פער ממורכז ב־12:00 כדי שהחיתוכים ייראו ישרים (כמו אינסטגרם)
    const baseRotation = -90 + GAP_DEG / 2;

    return Array.from({ length: segments }, (_, i) => ({
      dash: `${segLen} ${circumference - segLen}`,
      rotation: baseRotation + i * step,
    }));
  }, [segments, circumference]);

  return (
    <View style={{ width: size, height: size, marginBottom: 6 }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {arcs.map((a, i) => (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={a.dash}
            transform={`rotate(${a.rotation} ${cx} ${cy})`}
          />
        ))}
      </Svg>
      <View
        style={[
          styles.inner,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            borderColor: tokens.colors.background.primary,
            backgroundColor: tokens.colors.background.tertiary,
            top: (size - inner) / 2,
            left: (size - inner) / 2,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    position: 'absolute',
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
