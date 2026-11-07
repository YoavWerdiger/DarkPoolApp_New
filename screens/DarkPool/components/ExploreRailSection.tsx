import { UI_DIR } from '../../../lib/i18n/direction';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { darkPoolSectionTitleStyle } from '../darkPoolLayout';
import { EXPLORE_PROFILE_CARD, EXPLORE_RAIL_GAP } from '../utils/exploreGrid';
import { SkeletonBox } from '../../../components/ui/SkeletonLoader';
import { ExplorePortraitCard } from './ExplorePortraitCard';

interface Props {
  title: string;
  people: ExplorePerson[];
  onPersonPress: (person: ExplorePerson) => void;
  /** מציג את המדד בכרטיס (עודף תשואה) */
  showMetric?: boolean;
  /** הנתונים עוד לא הגיעו — כותרת אמיתית + כרטיסים בשלד */
  loading?: boolean;
}

/** רייל אופקי לגילוי — אותו כרטיס EXPLORE_PROFILE_CARD כמו כל המדפים. */
export function ExploreRailSection({
  title,
  people,
  onPersonPress,
  showMetric = false,
  loading = false,
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  if (!people.length && loading) {
    return (
      <View style={styles.wrap} pointerEvents="none">
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={[styles.cardRow, { overflow: 'hidden' }]}>
          {[0, 1, 2].map((i) => (
            <SkeletonBox
              key={i}
              width={EXPLORE_PROFILE_CARD.width}
              height={EXPLORE_PROFILE_CARD.height}
              borderRadius={tokens.borderRadius.xl}
            />
          ))}
        </View>
      </View>
    );
  }
  if (!people.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardRow}
      >
        {people.map((person) => (
          <ExplorePortraitCard
            key={`${person.kind}:${person.id}`}
            person={person}
            onPress={() => onPersonPress(person)}
            showMetric={showMetric}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      direction: UI_DIR,
      marginBottom: tokens.spacing.xl,
    },
    header: {
      direction: UI_DIR,
      alignSelf: 'stretch',
      alignItems: 'stretch',
      marginBottom: tokens.spacing.sm,
    },
    title: {
      ...darkPoolSectionTitleStyle,
      color: tokens.colors.text.primary,
    },
    cardRow: {
      direction: UI_DIR,
      flexDirection: 'row',
      justifyContent: 'flex-start',
      gap: EXPLORE_RAIL_GAP,
      paddingBottom: 4,
    },
  });
}
