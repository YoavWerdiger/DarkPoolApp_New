/**
 * כרטיס אדם בפס הבית — אווטאר עגול + שם (נראה כמו אדם, לא כרטיס מניה).
 */

import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { formatInsiderDisplayName } from '../utils/investorPlaceholder';
import { InvestorPortrait } from './InvestorPortrait';

interface Props {
  person: ExplorePerson;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function kindLabel(person: ExplorePerson): string {
  const fromSub = person.subtitle?.split('·')[0]?.trim();
  if (fromSub) return fromSub;
  if (person.kind === 'politician') return 'קונגרס';
  if (person.kind === 'fund_manager') return 'קרן';
  return person.ticker?.toUpperCase() || 'בכיר';
}

export function PeopleAvatarCard({ person, onPress, style }: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const displayName =
    person.kind === 'insider'
      ? formatInsiderDisplayName(person.name)
      : person.name;

  const content = (
    <View style={[styles.wrap, style]}>
      <View style={styles.avatarRing}>
        <InvestorPortrait
          name={displayName}
          imageUrl={person.image_url}
          ticker={person.ticker}
          kind={person.kind}
          personId={person.id}
          layout="circle"
          size={72}
        />
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {displayName}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {kindLabel(person)}
      </Text>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={() => {
        void HapticFeedback.selection();
        onPress();
      }}
      style={({ pressed }) => pressed && { opacity: 0.88 }}
    >
      {content}
    </Pressable>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      width: 88,
      alignItems: 'center',
      gap: 6,
    },
    avatarRing: {
      padding: 2,
      borderRadius: 40,
      borderWidth: 1.5,
      borderColor: `${tokens.colors.primary.main}55`,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    name: {
      fontSize: 12,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      textAlign: 'center',
      lineHeight: 15,
      minHeight: 30,
    },
    meta: {
      fontSize: 11,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
      textAlign: 'center',
    },
  });
}
