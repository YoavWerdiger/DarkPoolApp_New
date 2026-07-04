import React, { useMemo } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { ExplorePortraitCard } from './ExplorePortraitCard';

const COLS = 2;

interface Props {
  people: ExplorePerson[];
  onPersonPress: (person: ExplorePerson) => void;
  ListHeaderComponent?: React.ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentPaddingBottom?: number;
  emptyMessage?: string;
}

export function ExploreProfileGrid({
  people,
  onPersonPress,
  ListHeaderComponent,
  refreshing,
  onRefresh,
  contentPaddingBottom = 24,
  emptyMessage = 'אין פרופילים עם תמונה. משוך למטה לרענון.',
}: Props) {
  const tokens = useDesignTokens();
  const { cardWidth, gap } = useMemo(() => {
    const pad = tokens.layout.screenPadding;
    const g = 10;
    const w = Dimensions.get('window').width;
    const cw = (w - pad * 2 - g) / COLS;
    return { cardWidth: cw, gap: g };
  }, [tokens.layout.screenPadding]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: {
          paddingHorizontal: tokens.layout.screenPadding,
          paddingBottom: contentPaddingBottom,
        },
        row: {
          gap,
          marginBottom: gap,
        },
        empty: {
          paddingVertical: 48,
          paddingHorizontal: tokens.layout.screenPadding,
          alignItems: 'center',
        },
        emptyText: {
          fontSize: 14,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          lineHeight: 22,
        },
      }),
    [tokens, gap, contentPaddingBottom]
  );

  return (
    <FlatList
      data={people}
      keyExtractor={(item) => item.id}
      numColumns={COLS}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={ListHeaderComponent}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onPersonPress(item)}
          style={({ pressed }) => [{ width: cardWidth, opacity: pressed ? 0.92 : 1 }]}
        >
          <ExplorePortraitCard person={item} variant="grid" />
        </Pressable>
      )}
    />
  );
}
