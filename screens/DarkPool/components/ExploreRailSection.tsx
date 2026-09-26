import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import {
  darkPoolSectionSubtitleStyle,
  darkPoolSectionTitleStyle,
} from '../darkPoolLayout';
import { EXPLORE_RAIL_GAP } from '../utils/exploreGrid';
import { ExplorePortraitCard } from './ExplorePortraitCard';

interface Props {
  title: string;
  subtitle?: string;
  people: ExplorePerson[];
  onPersonPress: (person: ExplorePerson) => void;
}

/** רייל אופקי לגילוי — אותו כרטיס EXPLORE_PROFILE_CARD כמו כל המדפים. */
export function ExploreRailSection({
  title,
  subtitle,
  people,
  onPersonPress,
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  if (!people.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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
          />
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      direction: 'rtl',
      marginBottom: tokens.spacing.xl,
    },
    header: {
      direction: 'rtl',
      alignSelf: 'stretch',
      alignItems: 'stretch',
      marginBottom: tokens.spacing.sm,
    },
    title: {
      ...darkPoolSectionTitleStyle,
      color: tokens.colors.text.primary,
    },
    subtitle: {
      ...darkPoolSectionSubtitleStyle,
      color: tokens.colors.text.tertiary,
    },
    cardRow: {
      direction: 'rtl',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      gap: EXPLORE_RAIL_GAP,
      paddingBottom: 4,
    },
  });
}
