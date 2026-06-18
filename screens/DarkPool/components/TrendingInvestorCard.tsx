import React, { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { valuesToSparklinePoints } from '../utils/sparkline';
import { InvestorPortrait } from './InvestorPortrait';

interface Props {
  person: ExplorePerson;
  onPress: () => void;
}

export function TrendingInvestorCard({ person, onPress }: Props) {
  const tokens = useDesignTokens();
  const [chartW, setChartW] = useState(0);
  const chartH = 48;
  const positive = tokens.colors.primary.main;

  const spark = person.sparkline_values;
  const polyPoints = useMemo(
    () =>
      chartW > 4 && spark && spark.length >= 2
        ? valuesToSparklinePoints(spark, chartW, chartH)
        : '',
    [chartW, chartH, spark]
  );

  const metric =
    person.metric ??
    (person.activity_score != null ? String(person.activity_score) : null);
  const metricLabel = person.metric_label ?? 'עסקאות';

  const styles = useMemo(() => createStyles(tokens), [tokens]);

  return (
    <Pressable
      onPress={() => {
        void HapticFeedback.impactLight();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`פרופיל ${person.name}`}
      style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
    >
      <UICard
        variant="glass"
        glassIntensity="light"
        padding="md"
        style={styles.card}
      >
        <View style={styles.row}>
          <InvestorPortrait
            name={person.name}
            imageUrl={person.image_url}
            ticker={person.ticker}
            kind={person.kind}
            personId={person.id}
            layout="circle"
            size={52}
            style={styles.avatar}
          />
          <View style={styles.textCol}>
            <Text style={styles.name} numberOfLines={1}>
              {person.name}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {person.subtitle}
            </Text>
            {metric ? (
              <Text style={styles.metric}>
                <Text style={styles.metricVal}>{metric}</Text>
                {` ${metricLabel}`}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-back" size={18} color={tokens.colors.text.tertiary} />
        </View>
        <View
          style={styles.chartBox}
          onLayout={(e: LayoutChangeEvent) => {
            const w = Math.floor(e.nativeEvent.layout.width);
            if (w > 0 && Math.abs(w - chartW) > 1) setChartW(w);
          }}
        >
          {polyPoints ? (
            <Svg width={chartW} height={chartH}>
              <Polyline
                points={polyPoints}
                fill="none"
                stroke={positive}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </Svg>
          ) : (
            <Text style={styles.noChart}>פעילות דיווחים</Text>
          )}
        </View>
      </UICard>
    </Pressable>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    card: {
      borderRadius: tokens.borderRadius.xl,
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
      marginBottom: tokens.spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    textCol: {
      flex: 1,
      alignItems: 'flex-start',
    },
    name: {
      fontSize: 16,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'left',
    },
    subtitle: {
      marginTop: 2,
      fontSize: 12,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
    },
    metric: {
      marginTop: 4,
      fontSize: 12,
      color: tokens.colors.text.secondary,
      textAlign: 'left',
    },
    metricVal: {
      fontWeight: '800',
      color: tokens.colors.primary.main,
    },
    chartBox: {
      marginTop: 10,
      height: 48,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    noChart: {
      fontSize: 11,
      color: tokens.colors.text.tertiary,
    },
  });
}
