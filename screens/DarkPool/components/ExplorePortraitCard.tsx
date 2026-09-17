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
import { hebrewText, toDataIsland } from '../utils/bidi';

interface Props {
  person: ExplorePerson;
  variant?: 'large' | 'compact' | 'grid';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const ExplorePortraitCard = memo(function ExplorePortraitCard({
  person,
  variant = 'compact',
  onPress,
  style,
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(
    () => createStyles(tokens, variant),
    [tokens, variant]
  );

  const isGrid = variant === 'grid';
  const w = isGrid ? undefined : variant === 'large' ? 168 : 132;
  const h = isGrid ? undefined : variant === 'large' ? 220 : 176;
  const displayName =
    person.kind === 'insider'
      ? formatInsiderDisplayName(person.name)
      : person.name;
  const subtitleLabel = person.subtitle?.trim()
    ? person.subtitle
    : person.kind === 'politician'
      ? 'קונגרס'
      : person.kind === 'fund_manager'
        ? 'מנהל קרן'
        : person.ticker
          ? toDataIsland(person.ticker.toUpperCase())
          : 'בכיר';

  const content = (
    <View
      style={[
        styles.card,
        isGrid ? styles.gridCard : { width: w, height: h },
        style,
      ]}
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
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
          style={styles.footer}
        >
          <Text style={styles.name} numberOfLines={2}>
            {displayName}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitleLabel}
          </Text>
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

function createStyles(
  tokens: ReturnType<typeof useDesignTokens>,
  variant: 'large' | 'compact' | 'grid'
) {
  const nameSize = 
    variant === 'grid' ? tokens.typography.subhead.size : 
    variant === 'large' ? tokens.typography.callout.size : 
    tokens.typography.footnote.size;
    
  return StyleSheet.create({
    card: {
      borderRadius: tokens.borderRadius['2xl'],
      overflow: 'hidden',
      backgroundColor: tokens.colors.background.cardSolid,
      borderWidth: 0,
    },
    gridCard: {
      aspectRatio: 0.72,
      width: '100%',
    },
    bg: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    footer: {
      paddingHorizontal: tokens.spacing.sm + 2,
      paddingVertical: tokens.spacing.md,
      paddingTop: 36,
    },
    name: {
      ...hebrewText,
      fontSize: nameSize,
      fontWeight: tokens.typography.fontWeight.extrabold,
      color: '#fff',
    },
    subtitle: {
      ...hebrewText,
      marginTop: 4,
      fontSize: tokens.typography.caption2.size,
      fontWeight: tokens.typography.fontWeight.semibold,
      color: 'rgba(255,255,255,0.75)',
    },
    metric: {
      marginTop: 4,
      fontSize: tokens.typography.caption2.size,
      fontWeight: tokens.typography.fontWeight.semibold,
      color: 'rgba(255,255,255,0.7)',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    metricVal: {
      color: tokens.colors.primary.main,
      fontWeight: tokens.typography.fontWeight.extrabold,
    },
  });
}
