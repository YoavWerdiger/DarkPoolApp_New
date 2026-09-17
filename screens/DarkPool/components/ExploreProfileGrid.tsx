import React, { useCallback, useMemo } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { ExplorePortraitCard } from './ExplorePortraitCard';

const COLS = 2;
const ROW_GAP = 10;

interface Props {
  people: ExplorePerson[];
  onPersonPress: (person: ExplorePerson) => void;
  ListHeaderComponent?: React.ReactElement | null;
  ListFooterComponent?: React.ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentPaddingBottom?: number;
  emptyMessage?: string;
}

export function ExploreProfileGrid({
  people,
  onPersonPress,
  ListHeaderComponent,
  ListFooterComponent,
  refreshing,
  onRefresh,
  contentPaddingBottom = 24,
  emptyMessage = 'אין פרופילים עם תמונה. משוך למטה לרענון.',
}: Props) {
  const tokens = useDesignTokens();
  const { cardWidth, gap } = useMemo(() => {
    const pad = tokens.layout.screenPadding;
    const g = ROW_GAP;
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
          flexDirection: 'row',
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

  const renderItem: ListRenderItem<ExplorePerson> = useCallback(
    ({ item }) => (
      <Pressable
        onPress={() => onPersonPress(item)}
        style={({ pressed }) => [
          { width: cardWidth, opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <ExplorePortraitCard person={item} variant="grid" />
      </Pressable>
    ),
    [cardWidth, onPersonPress]
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
      ListFooterComponent={ListFooterComponent}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      }
      renderItem={renderItem}
      initialNumToRender={6}
      maxToRenderPerBatch={4}
      windowSize={5}
      updateCellsBatchingPeriod={40}
      removeClippedSubviews
    />
  );
}
