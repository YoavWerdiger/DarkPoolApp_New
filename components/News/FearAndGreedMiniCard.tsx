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
import { APP_LAYOUT, UI_CARD_RADIUS } from '../ui/appLayout';
import {
  APP_TYPE,
  appCaption2Style,
  appSectionTitleStyle,
} from '../ui/appType';
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
  const zonePrefix = !hasValue ? '' : zoneLabel === 'ניטרלי' ? 'השוק כרגע ' : 'השוק כרגע ב';
  const pct = Math.max(0, Math.min(100, value));

  const Body = (
    <View>
      <Text style={[styles.sectionTitle, { color: tokens.colors.text.primary }]}>
        מדד הפחד והתאווה
      </Text>
      <UICard
        variant="blur"
        padding="none"
        style={styles.card}
        contentContainerStyle={styles.content}
      >
        <View style={styles.topRow}>
          {loading && !hasValue ? (
            <ActivityIndicator size="small" color={tokens.colors.primary.main} />
          ) : (
            <View style={styles.valueBlock}>
              <Text style={[styles.valueNum, { color: zoneColor }]}>
                {hasValue ? value : '—'}
              </Text>
              <Text style={[styles.valueDen, { color: tokens.colors.text.secondary }]}>
                /100
              </Text>
            </View>
          )}

          <Text
            style={styles.zoneLabel}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            <Text style={{ color: tokens.colors.text.primary, fontWeight: APP_TYPE.body.fontWeight }}>
              {zonePrefix}
            </Text>
            <Text style={{ color: zoneColor }}>{zoneLabel}</Text>
          </Text>
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
                // רוחב יחסי לטווח (0–25, 25–45, 45–55…) — כך הסמן על 43 נופל בתוך «פחד» ולא ב«ניטרלי»
                { backgroundColor: s.color, flex: s.to - s.from },
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
              style={[styles.segLabel, { color: tokens.colors.text.tertiary, flex: s.to - s.from }]}
            >
              {s.label}
            </Text>
          ))}
        </View>
      </View>
    </UICard>
    </View>
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
        accessibilityLabel={`מדד הפחד והתאווה: ${value}, ${zonePrefix}${zoneLabel}`}
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
  sectionTitle: {
    ...appSectionTitleStyle,
    marginBottom: APP_LAYOUT.groupLabelToContent,
  },
  card: { borderRadius: UI_CARD_RADIUS },
  content: {
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingTop: APP_LAYOUT.cardPadding,
    paddingBottom: APP_LAYOUT.cardPadding,
    gap: APP_LAYOUT.cardTitleToBodyGap,
  },
  topRow: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  zoneLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: APP_TYPE.cardMetricValueSecondary.fontSize,
    lineHeight: APP_TYPE.cardMetricValueSecondary.lineHeight,
    fontWeight: APP_TYPE.cardMetricValueSecondary.fontWeight,
    letterSpacing: APP_TYPE.cardMetricValueSecondary.letterSpacing,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  valueBlock: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  valueNum: {
    fontSize: APP_TYPE.sectionTitle.fontSize,
    lineHeight: APP_TYPE.sectionTitle.lineHeight,
    fontWeight: APP_TYPE.sectionTitle.fontWeight,
    letterSpacing: APP_TYPE.sectionTitle.letterSpacing,
    textAlign: 'left',
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
  },
  valueDen: {
    ...APP_TYPE.groupLabel,
    textAlign: 'left',
    writingDirection: 'ltr',
    marginBottom: 2,
  },
  gaugeArea: {
    direction: 'ltr',
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
    // כמו שורת התוויות — 0 משמאל, 100 מימין, תואם ל-left של הסמן
    direction: 'ltr',
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
    direction: 'ltr',
    flexDirection: 'row',
    marginTop: APP_LAYOUT.groupLabelToContent,
  },
  segLabel: {
    ...appCaption2Style,
    flex: 1,
    width: undefined,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
