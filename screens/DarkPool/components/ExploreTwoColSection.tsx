import { UI_DIR } from '../../../lib/i18n/direction';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { darkPoolSectionTitleStyle } from '../darkPoolLayout';
import {
  EXPLORE_GRID_GAP,
  EXPLORE_GRID_ROWS,
  EXPLORE_PROFILE_CARD,
  chunkExploreColumns,
} from '../utils/exploreGrid';
import { ExplorePortraitCard } from './ExplorePortraitCard';
import { SkeletonBox } from '../../../components/ui/SkeletonLoader';

interface Props {
  title: string;
  people: ExplorePerson[];
  onPersonPress: (person: ExplorePerson) => void;
  /** הנתונים עוד לא הגיעו — כותרת אמיתית + כרטיסי דיוקן בשלד באותה רשת */
  loading?: boolean;
}

/** שני טורי דיוקן בגודל EXPLORE_PROFILE_CARD — גלילה אופקית לעוד אנשים. */
export function ExploreTwoColSection({
  title,
  people,
  onPersonPress,
  loading = false,
}: Props) {
  const tokens = useDesignTokens();
  const cardWidth = EXPLORE_PROFILE_CARD.width;
  const columns = useMemo(
    () => chunkExploreColumns(people, EXPLORE_GRID_ROWS),
    [people]
  );
  const styles = useMemo(() => createStyles(tokens, cardWidth), [tokens, cardWidth]);

  if (!people.length && loading) {
    return (
      <View style={styles.wrap} pointerEvents="none">
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={[styles.cardRow, { overflow: 'hidden' }]}>
          {[0, 1, 2].map((c) => (
            <View key={c} style={styles.column}>
              {Array.from({ length: EXPLORE_GRID_ROWS }, (_, r) => (
                <SkeletonBox
                  key={r}
                  width={cardWidth}
                  height={EXPLORE_PROFILE_CARD.height}
                  borderRadius={tokens.borderRadius.xl}
                />
              ))}
            </View>
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
