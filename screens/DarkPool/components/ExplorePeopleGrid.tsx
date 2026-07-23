import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { ExplorePortraitCard } from './ExplorePortraitCard';

const COLS = 2;

interface Props {
  people: ExplorePerson[];
  onPersonPress: (person: ExplorePerson) => void;
  emptyMessage?: string;
}

/** גריד 2 עמודות — ScrollView ב-parent (יציב ב-RTL) */
export function ExplorePeopleGrid({
  people,
  onPersonPress,
  emptyMessage = 'אין פרופילים להצגה',
}: Props) {
  const tokens = useDesignTokens();
  const cardWidth = useMemo(() => {
    const pad = tokens.layout.screenPadding;
    const gap = 10;
    const w = Dimensions.get('window').width;
    return (w - pad * 2 - gap) / COLS;
  }, [tokens.layout.screenPadding]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
          direction: 'rtl',
          paddingHorizontal: tokens.layout.screenPadding,
        },
        cell: {
          width: cardWidth,
        },
        empty: {
          paddingVertical: 40,
          paddingHorizontal: tokens.layout.screenPadding,
        },
        emptyText: {
          fontSize: 14,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          lineHeight: 22,
        },
      }),
    [tokens, cardWidth]
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
            variant="grid"
            onPress={() => onPersonPress(person)}
          />
        </View>
      ))}
    </View>
  );
}
