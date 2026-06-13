import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { TrendingInvestorCard } from './TrendingInvestorCard';

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
          fontSize: 18,
          fontWeight: '800',
          color: tokens.colors.text.primary,
          textAlign: 'left',
          writingDirection: 'rtl',
        },
        subtitle: {
          marginTop: 4,
          marginBottom: tokens.spacing.sm,
          fontSize: 12,
          color: tokens.colors.text.tertiary,
          textAlign: 'left',
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
