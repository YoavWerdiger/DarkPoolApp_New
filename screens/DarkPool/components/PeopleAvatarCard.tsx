/**
 * כרטיס אדם בפס הבית — אווטאר עגול + שם (נראה כמו אדם, לא כרטיס מניה).
 */

import React, { memo, useMemo } from 'react';
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
import { dataText, hebrewText, rowMixed } from '../utils/bidi';

interface Props {
  person: ExplorePerson;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function kindLabel(person: ExplorePerson): string {
  const fromSub = person.subtitle?.split('·')[0]?.trim();
  if (fromSub) return fromSub;
  if (person.kind === 'politician') return 'לוויתן קונגרס';
  if (person.kind === 'fund_manager') return 'לוויתן מוסדי';
  return person.ticker?.toUpperCase() || 'לוויתן שוק';
}

export const PeopleAvatarCard = memo(function PeopleAvatarCard({
  person,
  onPress,
  style,
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const displayName =
    person.kind === 'insider'
      ? formatInsiderDisplayName(person.name)
      : person.name;

  const content = (
    <View style={[styles.wrap, style]}>
      <View style={styles.identity}>
        <View style={styles.textCol}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {kindLabel(person)}
          </Text>
        </View>
        <InvestorPortrait
          name={displayName}
          imageUrl={person.image_url}
          ticker={person.ticker}
          kind={person.kind}
          personId={person.id}
          layout="circle"
          size={48}
          priority="high"
        />
      </View>
      {!!person.ticker?.trim() ? (
        <Text style={styles.tickerText} numberOfLines={1}>
          {person.ticker.toUpperCase()}
        </Text>
      ) : null}
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
});

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      borderRadius: 16,
      borderWidth: 0,
      backgroundColor: tokens.colors.background.cardSolid,
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 6,
    },
    identity: {
      ...rowMixed,
      justifyContent: 'space-between',
      gap: 8,
    },
    textCol: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-end',
    },
    name: {
      ...hebrewText,
      fontSize: 13,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      lineHeight: 17,
    },
    meta: {
      ...hebrewText,
      fontSize: 11,
      fontWeight: '500',
      color: tokens.colors.text.secondary,
    },
    tickerText: {
      ...dataText,
      fontSize: 11,
      fontWeight: '700',
      color: tokens.colors.primary.main,
      letterSpacing: 0.4,
      alignSelf: 'flex-end',
    },
  });
}
