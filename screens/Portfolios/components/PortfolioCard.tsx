import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import type { Portfolio, PortfolioSummary } from '../portfolioTypes';
import { formatCurrency, formatRelative } from '../utils/format';
import {
  JOURNAL_LAYOUT,
  JOURNAL_TYPE,
  journalCardMetricLabelStyle,
  journalCardMetricValueStyle,
  journalCardSubtitleStyle,
  journalHebrewText,
  journalRow,
  journalRtlContent,
} from '../../Journal/journalLayout';

const HEBREW_LETTER = /[\u0590-\u05FF]/;
const SNAPSHOT_H = 56;
const SNAPSHOT_PAD = 2;

/** שם לועזי נשאר LTR ומיושר לימין — writingDirection rtl מדביק אותו לשורת «עודכן». */
function portfolioNameIsLatin(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && !HEBREW_LETTER.test(trimmed);
}

/** המספר נשאר צמוד למילה («תיק 001»), לא קופץ לקצה השמאלי. */
function isolateNumericRuns(text: string): string {
  return text.replace(/\d+(?:[.,]\d+)*/g, (run) => `\u2066${run}\u2069`);
}

function snapshotGeometry(values: number[], width: number) {
  if (values.length < 2 || width < 8) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = width - SNAPSHOT_PAD * 2;
  const innerH = SNAPSHOT_H - SNAPSHOT_PAD * 2;
  const points = values.map((value, index) => ({
    x: SNAPSHOT_PAD + (index / (values.length - 1)) * innerW,
    y: SNAPSHOT_PAD + (1 - (value - min) / span) * innerH,
  }));
  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const area = `${line} L${last.x.toFixed(1)},${SNAPSHOT_H} L${first.x.toFixed(1)},${SNAPSHOT_H} Z`;
  return { line, area, end: last };
}

interface Props {
  portfolio: Portfolio;
  summary: PortfolioSummary | null;
  /** נקודות שווי אמיתיות. בלי שתי נקודות אין קו. */
  sparklineValues?: number[] | null;
  onPress: () => void;
  onLongPress?: () => void;
}

/**
 * כרטיס תיק ברשימה — שם, עדכון ושווי.
 * בלי אייקון ובלי שורת מדדים. הסנאפשוט יושב על הכרטיס, ליד השווי.
 */
export function PortfolioCard({
  portfolio,
  summary,
  sparklineValues,
  onPress,
  onLongPress,
}: Props) {
  const tokens = useDesignTokens();
  const latinName = portfolioNameIsLatin(portfolio.name);
  const [snapshotWidth, setSnapshotWidth] = React.useState(0);
  const snapshot = useMemo(
    () => snapshotGeometry(sparklineValues ?? [], snapshotWidth),
    [sparklineValues, snapshotWidth],
  );
  const lineColor =
    sparklineValues && sparklineValues.length >= 2 && sparklineValues[sparklineValues.length - 1] < sparklineValues[0]
      ? tokens.colors.text.danger
      : tokens.colors.primary.main;

  return (
    <View style={styles.rowOuter}>
      <Pressable
        onPress={() => {
          void HapticFeedback.impactLight();
          onPress();
        }}
        onLongPress={
          onLongPress
            ? () => {
                void HapticFeedback.medium();
                onLongPress();
              }
            : undefined
        }
        delayLongPress={450}
        style={({ pressed }) => [styles.pressInner, pressed && styles.pressInnerPressed]}
      >
        <UICard
          variant="soft"
          padding="md"
          style={{ backgroundColor: tokens.colors.background.cardSolid }}
        >
          <View style={styles.cardInner}>
            <View style={styles.header}>
              <View style={styles.titleBlock}>
                <Text
                  style={[
                    styles.title,
                    { color: tokens.colors.text.primary },
                    latinName ? styles.titleLatin : styles.titleHebrew,
                  ]}
                  numberOfLines={1}
                >
                  {latinName ? portfolio.name : isolateNumericRuns(portfolio.name)}
                </Text>
                <View style={styles.metaRow}>
                  <Text
                    style={[styles.meta, { color: tokens.colors.text.secondary }]}
                    numberOfLines={1}
                  >
                    {isolateNumericRuns(`עודכן ${formatRelative(portfolio.updated_at)}`)}
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-back"
                size={20}
                color={tokens.colors.text.tertiary}
              />
            </View>

            <View style={[styles.valueRow, !(sparklineValues && sparklineValues.length >= 2) && styles.valueRowPlain]}>
              {sparklineValues && sparklineValues.length >= 2 ? (
                <View
                  style={styles.snapshot}
                  onLayout={(event) => {
                    const next = Math.round(event.nativeEvent.layout.width);
                    if (next !== snapshotWidth) setSnapshotWidth(next);
                  }}
                >
                  {snapshot ? (
                    <Svg width={snapshotWidth} height={SNAPSHOT_H}>
                      <Path d={snapshot.area} fill={lineColor} fillOpacity={0.16} />
                      <Path
                        d={snapshot.line}
                        stroke={lineColor}
                        strokeWidth={2.5}
                        fill="none"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      <Circle cx={snapshot.end.x} cy={snapshot.end.y} r={3} fill={lineColor} />
                    </Svg>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.valueBlock}>
                <Text style={[styles.valueLabel, { color: tokens.colors.text.secondary }]}>
                  שווי תיק
                </Text>
                <Text style={[styles.valueAmount, { color: tokens.colors.text.primary }]}>
                  {summary ? formatCurrency(summary.total_value, portfolio.currency) : '—'}
                </Text>
              </View>
            </View>
          </View>
        </UICard>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rowOuter: {
    marginBottom: JOURNAL_LAYOUT.cardStackGap,
  },
  pressInner: {},
  pressInnerPressed: {
    opacity: 0.9,
  },
  cardInner: {
    ...journalRtlContent,
  },
  header: {
    ...journalRow,
    alignItems: 'center',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    direction: 'ltr',
    alignItems: 'stretch',
  },
  title: {
    width: '100%',
    alignSelf: 'stretch',
    flexShrink: 1,
    minWidth: 0,
    fontSize: JOURNAL_TYPE.cardTitle.fontSize,
    fontWeight: JOURNAL_TYPE.cardTitle.fontWeight,
    lineHeight: JOURNAL_TYPE.cardTitle.lineHeight,
    letterSpacing: JOURNAL_TYPE.cardTitle.letterSpacing,
    includeFontPadding: false,
  },
  titleHebrew: {
    ...journalHebrewText,
  },
  titleLatin: {
    direction: 'ltr',
    writingDirection: 'ltr',
    textAlign: 'right',
  },
  metaRow: {
    width: '100%',
    marginTop: JOURNAL_LAYOUT.cardTitleToSubtitleGap,
    direction: 'ltr',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    ...journalCardSubtitleStyle,
    width: undefined,
    flexShrink: 1,
    marginTop: 0,
    textAlign: 'right',
    includeFontPadding: false,
  },
  valueRow: {
    marginTop: JOURNAL_LAYOUT.cardTitleToBodyGap,
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
  },
  valueRowPlain: {
    justifyContent: 'flex-end',
  },
  snapshot: {
    flex: 1,
    height: SNAPSHOT_H,
    minWidth: 0,
  },
  valueBlock: {
    direction: 'ltr',
    alignItems: 'flex-end',
  },
  valueLabel: {
    ...journalCardMetricLabelStyle,
    marginBottom: JOURNAL_LAYOUT.cardMetricLabelToValueGap,
    textAlign: 'right',
    includeFontPadding: false,
  },
  valueAmount: {
    ...journalCardMetricValueStyle,
    textAlign: 'right',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
});
