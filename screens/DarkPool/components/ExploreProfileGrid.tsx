import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalRightText,
} from '../darkPoolLayout';
import {
  EXPLORE_GRID_COLS,
  EXPLORE_GRID_GAP,
  EXPLORE_PROFILE_CARD,
} from '../utils/exploreGrid';
import { ExplorePortraitCard } from './ExplorePortraitCard';

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
  const cardWidth = EXPLORE_PROFILE_CARD.width;
  const gap = EXPLORE_GRID_GAP;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: {
          direction: 'rtl',
          paddingHorizontal: tokens.layout.screenPadding,
          paddingBottom: contentPaddingBottom,
        },
        row: {
          direction: 'rtl',
          flexDirection: 'row',
          justifyContent: 'flex-start',
          gap,
          marginBottom: gap,
        },
        empty: {
          direction: 'rtl',
          paddingVertical: 48,
          alignSelf: 'stretch',
          alignItems: 'stretch',
        },
        emptyText: {
          ...darkPoolPhysicalRightText,
          width: '100%',
          fontSize: DARK_POOL_TYPE.body.fontSize,
          lineHeight: DARK_POOL_TYPE.body.lineHeight,
          color: tokens.colors.text.tertiary,
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
        <ExplorePortraitCard person={item} />
      </Pressable>
    ),
    [cardWidth, onPersonPress]
  );

  return (
    <FlatList
      data={people}
      keyExtractor={(item) => item.id}
      numColumns={EXPLORE_GRID_COLS}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: 'transparent' }}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={
        emptyMessage ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        ) : null
      }
      renderItem={renderItem}
      initialNumToRender={6}
      maxToRenderPerBatch={4}
      windowSize={5}
      updateCellsBatchingPeriod={40}
      removeClippedSubviews={false}
    />
  );
}
