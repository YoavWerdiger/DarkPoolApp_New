import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { DistributionSlice } from '../portfolioTypes';
import { formatPercent } from '../utils/format';

interface Props {
  slices: DistributionSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}

/**
 * Donut chart פשוט מבוסס SVG – ללא תלויות חיצוניות.
 * מצייר circles עם stroke-dasharray כדי להציג סלייסים.
 */
export function DistributionDonut({
  slices,
  size = 180,
  strokeWidth = 22,
  centerLabel,
  centerValue,
}: Props) {
  const tokens = useDesignTokens();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const total = slices.reduce((s, x) => s + x.percentage, 0);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {slices.map((s, i) => {
          const dash = (s.percentage / 100) * circumference;
          const gap = circumference - dash;
          const offset = -((cumulative / 100) * circumference);
          cumulative += s.percentage;
          return (
            <Circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={s.color || tokens.colors.primary.main}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              fill="transparent"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </Svg>

      <View style={[styles.center, { width: size, height: size }]}>
        {centerLabel ? (
          <Text style={[styles.centerLabel, { color: tokens.colors.text.tertiary }]}>
            {centerLabel}
          </Text>
        ) : null}
        {centerValue ? (
          <Text style={[styles.centerValue, { color: tokens.colors.text.primary }]}>
            {centerValue}
          </Text>
        ) : (
          <Text style={[styles.centerValue, { color: tokens.colors.text.primary }]}>
            {formatPercent(total, 1, false)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    fontSize: 10,
  },
  centerValue: {
    fontSize: 18,
    fontWeight: '700',
  },
});
