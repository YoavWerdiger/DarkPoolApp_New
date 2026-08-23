import React, { useMemo } from 'react';
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

interface Props {
  person: ExplorePerson;
  variant?: 'large' | 'compact' | 'grid';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ExplorePortraitCard({
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
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
          style={styles.footer}
        >
          <Text style={styles.name} numberOfLines={2}>
            {displayName}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {person.subtitle?.trim()
              ? person.subtitle
              : person.kind === 'politician'
                ? 'קונגרס'
                : person.kind === 'fund_manager'
                  ? 'מנהל קרן'
                  : person.ticker || 'בכיר'}
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
}

function createStyles(
  tokens: ReturnType<typeof useDesignTokens>,
  variant: 'large' | 'compact' | 'grid'
) {
  return StyleSheet.create({
    card: {
      borderRadius: tokens.borderRadius['2xl'],
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
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
      paddingHorizontal: 10,
      paddingVertical: 12,
      paddingTop: 36,
    },
    name: {
      fontSize: variant === 'grid' ? 14 : variant === 'large' ? 15 : 13,
      fontWeight: '800',
      color: '#fff',
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    subtitle: {
      marginTop: 4,
      fontSize: 11,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.75)',
      textAlign: 'left',
    },
    metric: {
      marginTop: 4,
      fontSize: 11,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.7)',
      textAlign: 'left',
    },
    metricVal: {
      color: tokens.colors.primary.main,
      fontWeight: '800',
    },
  });
}
