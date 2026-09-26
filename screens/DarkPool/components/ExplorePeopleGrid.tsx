import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { darkPoolPhysicalRightText } from '../darkPoolLayout';
import { EXPLORE_GRID_GAP, EXPLORE_PROFILE_CARD } from '../utils/exploreGrid';
import { ExplorePortraitCard } from './ExplorePortraitCard';

interface Props {
  people: ExplorePerson[];
  onPersonPress: (person: ExplorePerson) => void;
  emptyMessage?: string;
  padded?: boolean;
}

/** גריד 2 עמודות — ScrollView ב-parent (יציב ב-RTL) */
export function ExplorePeopleGrid({
  people,
  onPersonPress,
  emptyMessage = 'אין פרופילים להצגה',
  padded = true,
}: Props) {
  const tokens = useDesignTokens();
  const cardWidth = EXPLORE_PROFILE_CARD.width;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: EXPLORE_GRID_GAP,
          direction: 'rtl',
          paddingHorizontal: padded ? tokens.layout.screenPadding : 0,
        },
        cell: {
          width: cardWidth,
        },
        empty: {
          direction: 'rtl',
          paddingVertical: 40,
          paddingHorizontal: padded ? tokens.layout.screenPadding : 0,
          alignItems: 'stretch',
        },
        emptyText: {
          ...darkPoolPhysicalRightText,
          width: '100%',
          fontSize: 15,
          color: tokens.colors.text.tertiary,
          lineHeight: 22,
        },
      }),
    [tokens, cardWidth, padded]
  );

  if (!people.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {people.map((person) => (
        <View key={person.id} style={styles.cell}>
          <ExplorePortraitCard
            person={person}
            onPress={() => onPersonPress(person)}
          />
        </View>
      ))}
    </View>
  );
}
