import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { TrendingInvestorCard } from './TrendingInvestorCard';
import {
  darkPoolSectionSubtitleStyle,
  darkPoolSectionTitleStyle,
} from '../darkPoolLayout';

interface Props {
  title: string;
  subtitle?: string;
  people: ExplorePerson[];
  onPersonPress: (person: ExplorePerson) => void;
}

export function ExploreTrendingSection({
  title,
  subtitle,
  people,
  onPersonPress,
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          direction: 'rtl',
          marginHorizontal: tokens.layout.screenPadding,
          marginBottom: tokens.spacing.lg,
        },
        title: {
          ...darkPoolSectionTitleStyle,
          color: tokens.colors.text.primary,
        },
        subtitle: {
          ...darkPoolSectionSubtitleStyle,
          marginBottom: tokens.spacing.sm,
          color: tokens.colors.text.tertiary,
        },
      }),
    [tokens]
  );

  if (!people.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {people.map((p) => (
        <TrendingInvestorCard key={p.id} person={p} onPress={() => onPersonPress(p)} />
      ))}
    </View>
  );
}
