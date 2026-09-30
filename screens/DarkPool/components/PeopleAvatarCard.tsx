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
import { UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import { APP_TYPE } from '../../../components/ui/appType';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { formatInsiderDisplayName } from '../utils/investorPlaceholder';
import { InvestorPortrait } from './InvestorPortrait';
import { dataText, rowMixed } from '../utils/bidi';
import { darkPoolPhysicalRightText } from '../darkPoolLayout';

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
    <UICard variant="soft" glassIntensity="light" padding="none" disableBlur style={[styles.wrap, style]}>
      <View style={styles.inner}>
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
    </UICard>
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
      borderRadius: UI_CARD_RADIUS,
      backgroundColor: 'transparent',
    },
    inner: {
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
      alignItems: 'stretch',
    },
    name: {
      ...darkPoolPhysicalRightText,
      fontSize: APP_TYPE.cardSubtitle.fontSize,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
      lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    },
    meta: {
      ...darkPoolPhysicalRightText,
      fontSize: APP_TYPE.caption2.fontSize,
      lineHeight: APP_TYPE.caption2.lineHeight,
      fontWeight: APP_TYPE.caption2.fontWeight,
      color: tokens.colors.text.secondary,
    },
    tickerText: {
      ...dataText,
      fontSize: APP_TYPE.caption2.fontSize,
      lineHeight: APP_TYPE.caption2.lineHeight,
      fontWeight: APP_TYPE.caption2.fontWeight,
      color: tokens.colors.text.secondary,
      letterSpacing: 0.4,
      alignSelf: 'flex-end',
    },
  });
}
