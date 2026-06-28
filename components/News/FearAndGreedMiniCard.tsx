import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
import {
  fearAndGreedService,
  FEAR_GREED_MINI_SEGMENTS,
} from '../../services/fearAndGreedService';
import { useFearAndGreed } from '../../hooks/useFearAndGreed';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Props = { onPress?: () => void };

const SEGMENTS = FEAR_GREED_MINI_SEGMENTS;

export default function FearAndGreedMiniCard({ onPress }: Props) {
  const tokens = useDesignTokens();
  const { data: response, isLoading, isFetching } = useFearAndGreed();
  const data = response?.fgi.now ?? null;
  const loading = (isLoading || isFetching) && !data;

  const hasValue = data != null && typeof data.value === 'number';
  const value = hasValue ? data!.value : 0;
  const zoneColor = hasValue
    ? fearAndGreedService.getValueColor(value)
    : tokens.colors.text.tertiary;
  const zoneLabel = hasValue
    ? fearAndGreedService.getValueDescription(value)
    : loading
      ? 'טוען…'
      : '—';
  const pct = Math.max(0, Math.min(100, value));

  const Body = (
    <UICard
      variant="blur"
      padding="none"
      style={styles.card}
      contentContainerStyle={styles.content}
    >
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: tokens.colors.text.tertiary }]}>
            מדד הפחד והתאווה
          </Text>
          <Text style={[styles.zoneLabel, { color: zoneColor }]} numberOfLines={1}>
            {zoneLabel}
          </Text>
        </View>

        {loading && !hasValue ? (
          <ActivityIndicator size="small" color={tokens.colors.primary.main} />
        ) : (
          <View style={styles.valueBlock}>
            <Text style={[styles.valueNum, { color: zoneColor }]}>
              {hasValue ? value : '—'}
            </Text>
            <Text style={[styles.valueDen, { color: tokens.colors.text.tertiary }]}>
              /100
            </Text>
          </View>
        )}
      </View>

      <View style={styles.gaugeArea}>
        {hasValue ? (
          <View
            pointerEvents="none"
            style={[
              styles.triangle,
              { left: `${pct}%` as any, borderTopColor: zoneColor },
            ]}
          />
        ) : null}

        <View style={styles.barRow}>
          {SEGMENTS.map((s, i) => (
            <View
              key={s.label}
              style={[
                styles.barSegment,
                { backgroundColor: s.color },
                i === 0 && styles.barLeft,
                i === SEGMENTS.length - 1 && styles.barRight,
                i > 0 && styles.barGap,
              ]}
            />
          ))}
        </View>

        <View style={styles.labelsRow}>
          {SEGMENTS.map((s) => (
            <Text
              key={s.label}
              numberOfLines={2}
              style={[styles.segLabel, { color: tokens.colors.text.tertiary }]}
            >
              {s.label}
            </Text>
          ))}
        </View>
      </View>
    </UICard>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={() => {
          void HapticFeedback.impactLight();
          onPress();
        }}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`מדד הפחד והתאווה: ${value} ${zoneLabel}`}
      >
        {Body}
      </TouchableOpacity>
    );
  }
  return Body;
}

const BAR_H = 12;
const TRI_W = 10;
const TRI_H = 8;

const styles = StyleSheet.create({
  card: { borderRadius: 14 },
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: { alignItems: 'flex-end', flex: 1 },
  title: {
    fontSize: 11,
    fontWeight: '500',
  },
  zoneLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  valueBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  valueNum: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 34,
    fontVariant: ['tabular-nums'],
  },
  valueDen: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 3,
    marginLeft: 1,
  },
  gaugeArea: {
    gap: 0,
  },
  triangle: {
    position: 'absolute',
    top: 0,
    marginLeft: -(TRI_W / 2),
    width: 0,
    height: 0,
    borderLeftWidth: TRI_W / 2,
    borderRightWidth: TRI_W / 2,
    borderTopWidth: TRI_H,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    zIndex: 2,
  },
  barRow: {
    flexDirection: 'row',
    height: BAR_H,
    marginTop: TRI_H + 2,
  },
  barSegment: {
    flex: 1,
    height: BAR_H,
  },
  barGap: {
    marginLeft: 2,
  },
  barLeft: {
    borderTopLeftRadius: BAR_H / 2,
    borderBottomLeftRadius: BAR_H / 2,
  },
  barRight: {
    borderTopRightRadius: BAR_H / 2,
    borderBottomRightRadius: BAR_H / 2,
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: 5,
  },
  segLabel: {
    flex: 1,
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 12,
  },
});
