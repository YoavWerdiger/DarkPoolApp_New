import React, { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { formatInsiderDisplayName } from '../utils/investorPlaceholder';
import { InvestorPortrait } from './InvestorPortrait';
import { isolateData, toDataIsland } from '../utils/bidi';
import { darkPoolPhysicalRightText } from '../darkPoolLayout';
import {
  isNegativeReturnMetric,
  isReturnMetric,
} from '../utils/exploreDisplay';
import { EXPLORE_PROFILE_CARD } from '../utils/exploreGrid';

interface Props {
  person: ExplorePerson;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const ExplorePortraitCard = memo(function ExplorePortraitCard({
  person,
  onPress,
  style,
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { width: cardW, height: cardH } = EXPLORE_PROFILE_CARD;
  const displayName =
    person.kind === 'insider'
      ? formatInsiderDisplayName(person.name)
      : person.name;
  const kindFallback = person.subtitle?.trim()
    ? person.subtitle
    : person.kind === 'politician'
      ? 'קונגרס'
      : person.kind === 'fund_manager'
        ? 'מנהל קרן'
        : person.ticker
          ? toDataIsland(person.ticker.toUpperCase())
          : 'בכיר';

  const metric = person.metric?.trim() || undefined;
  const pct = isReturnMetric(metric);
  const metricColor = !metric
    ? undefined
    : pct
      ? isNegativeReturnMetric(metric)
        ? tokens.colors.text.danger
        : tokens.colors.primary.main
      : 'rgba(255,255,255,0.78)';

  const content = (
    <View
      style={[styles.card, { width: cardW, height: cardH }, style]}
    >
      <InvestorPortrait
        name={displayName}
        imageUrl={person.image_url}
        ticker={person.ticker}
        kind={person.kind}
        personId={person.id}
        layout="card"
        style={styles.bg}
        priority="high"
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.22)', 'rgba(0,0,0,0.88)']}
          locations={[0, 0.52, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.footer}
        >
          <Text style={styles.name} numberOfLines={2}>
            {displayName}
          </Text>
          {metric ? (
            <Text style={[styles.metric, { color: metricColor }]} numberOfLines={1}>
              {pct ? isolateData(metric) : metric}
            </Text>
          ) : (
            <Text style={styles.subtitle} numberOfLines={1}>
              {kindFallback}
            </Text>
          )}
        </LinearGradient>
      </InvestorPortrait>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={() => {
        void HapticFeedback.selection();
        onPress();
      }}
      style={({ pressed }) => pressed && { opacity: 0.92 }}
    >
      {content}
    </Pressable>
  );
});

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  const nameSize = 12;

  return StyleSheet.create({
    card: {
      borderRadius: tokens.borderRadius.xl,
      overflow: 'hidden',
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    bg: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    footer: {
      direction: 'ltr',
      alignItems: 'flex-end',
      paddingHorizontal: 10,
      paddingBottom: 8,
      paddingTop: 36,
    },
    name: {
      ...darkPoolPhysicalRightText,
      width: '100%',
      fontSize: nameSize,
      lineHeight: nameSize + 3,
      fontWeight: tokens.typography.fontWeight.extrabold,
      color: '#fff',
    },
    subtitle: {
      ...darkPoolPhysicalRightText,
      width: '100%',
      marginTop: 2,
      fontSize: tokens.typography.caption2.size,
      fontWeight: tokens.typography.fontWeight.semibold,
      color: 'rgba(255,255,255,0.72)',
    },
    metric: {
      ...darkPoolPhysicalRightText,
      width: '100%',
      marginTop: 2,
      fontSize: 12,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
