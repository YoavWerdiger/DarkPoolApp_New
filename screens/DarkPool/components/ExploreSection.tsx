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
  onPersonPress?: (person: ExplorePerson) => void;
}

export function ExploreSection({
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
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {people.map((p) => (
          <ExplorePortraitCard
            key={p.id}
            person={p}
            onPress={onPersonPress ? () => onPersonPress(p) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      marginBottom: tokens.layout.sectionGap,
      direction: 'rtl',
    },
    header: {
      direction: 'rtl',
      paddingHorizontal: tokens.layout.screenPadding,
      marginBottom: tokens.layout.sectionHeaderToContent,
      alignSelf: 'stretch',
      alignItems: 'stretch',
    },
    title: {
      ...darkPoolSectionTitleStyle,
      color: tokens.colors.text.primary,
    },
    subtitle: {
      ...darkPoolSectionSubtitleStyle,
      color: tokens.colors.text.secondary,
    },
    row: {
      direction: 'rtl',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      paddingHorizontal: tokens.layout.screenPadding,
      gap: EXPLORE_RAIL_GAP,
      paddingBottom: 4,
    },
  });
}
