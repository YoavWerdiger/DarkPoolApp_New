import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import {
  darkPoolSectionSubtitleStyle,
  darkPoolSectionTitleStyle,
} from '../darkPoolLayout';
import {
  EXPLORE_GRID_GAP,
  EXPLORE_GRID_ROWS,
  EXPLORE_PROFILE_CARD,
  chunkExploreColumns,
} from '../utils/exploreGrid';
import { ExplorePortraitCard } from './ExplorePortraitCard';

interface Props {
  title: string;
  subtitle?: string;
  people: ExplorePerson[];
  onPersonPress: (person: ExplorePerson) => void;
}

/** שני טורי דיוקן בגודל EXPLORE_PROFILE_CARD — גלילה אופקית לעוד אנשים. */
export function ExploreTwoColSection({
  title,
  subtitle,
  people,
  onPersonPress,
}: Props) {
  const tokens = useDesignTokens();
  const cardWidth = EXPLORE_PROFILE_CARD.width;
  const columns = useMemo(
    () => chunkExploreColumns(people, EXPLORE_GRID_ROWS),
    [people]
  );
  const styles = useMemo(() => createStyles(tokens, cardWidth), [tokens, cardWidth]);

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
        {columns.map((col, colIndex) => (
          <View
            key={col.map((p) => `${p.kind}:${p.id}`).join('|') || String(colIndex)}
            style={styles.column}
          >
            {col.map((person) => (
              <View key={`${person.kind}:${person.id}`} style={styles.cell}>
                <ExplorePortraitCard
                  person={person}
                  onPress={() => onPersonPress(person)}
                />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(
  tokens: ReturnType<typeof useDesignTokens>,
  cardWidth: number
) {
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
      gap: EXPLORE_GRID_GAP,
      paddingBottom: 4,
    },
    column: {
      width: cardWidth,
      gap: EXPLORE_GRID_GAP,
    },
    cell: {
      width: cardWidth,
    },
  });
}
