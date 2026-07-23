import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { ExplorePortraitCard } from './ExplorePortraitCard';

interface Props {
  title: string;
  subtitle?: string;
  people: ExplorePerson[];
  variant?: 'large' | 'compact';
  onPersonPress?: (person: ExplorePerson) => void;
}

export function ExploreSection({
  title,
  subtitle,
  people,
  variant = 'compact',
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
            variant={variant}
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
      marginBottom: tokens.spacing.lg,
      direction: 'rtl',
    },
    header: {
      paddingHorizontal: tokens.layout.screenPadding,
      marginBottom: tokens.spacing.sm,
      alignItems: 'flex-start',
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    subtitle: {
      marginTop: 4,
      fontSize: 13,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    row: {
      flexDirection: 'row',
      paddingHorizontal: tokens.layout.screenPadding,
      gap: 12,
      paddingBottom: 4,
    },
  });
}
