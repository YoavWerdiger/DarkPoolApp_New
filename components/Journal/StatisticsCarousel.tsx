import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';

const AUTO_SCROLL_MS = 3500;
const RTL_FLIP = { transform: [{ scaleX: -1 }] };

export interface StatisticItem {
  id: string;
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  subtitle?: string;
}

interface StatisticsCarouselProps {
  statistics: StatisticItem[];
}

export default function StatisticsCarousel({ statistics }: StatisticsCarouselProps) {
  const DesignTokens = useDesignTokens();
  const { width: screenW } = useWindowDimensions();

  const layout = useMemo(() => {
    /** כרטיס צר יותר — רואים קצת מהבא, גלילה נוחה */
    const cardWidth = Math.min(screenW * 0.68, 260);
    const cardSpacing = 8;
    const snapInterval = cardWidth + cardSpacing;
    const sidePad = Math.max(0, (screenW - cardWidth) / 2);
    return { cardWidth, cardSpacing, snapInterval, sidePad };
  }, [screenW]);

  const styles = useMemo(() => createStyles(DesignTokens, layout), [DesignTokens, layout]);

  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const currentIndexRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const autoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUserScrollingRef = useRef(false);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  }, []);

  const syncIndexFromOffset = useCallback(
    (offsetX: number) => {
      const { snapInterval } = layout;
      if (snapInterval <= 0) return;
      const idx = Math.round(Math.abs(offsetX) / snapInterval);
      const clamped = Math.max(0, Math.min(idx, statistics.length - 1));
      if (clamped !== currentIndexRef.current) {
        currentIndexRef.current = clamped;
        setCurrentIndex(clamped);
      }
    },
    [layout.snapInterval, statistics.length]
  );

  const scrollToNext = useCallback(() => {
    if (statistics.length <= 1 || isUserScrollingRef.current) return;
    const next = (currentIndexRef.current + 1) % statistics.length;
    currentIndexRef.current = next;
    setCurrentIndex(next);
    flatListRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0.5 });
  }, [statistics.length, layout.snapInterval]);

  const startAutoScroll = useCallback(() => {
    stopAutoScroll();
    if (statistics.length <= 1) return;
    autoScrollTimerRef.current = setInterval(() => {
      if (!isUserScrollingRef.current) {
        scrollToNext();
      }
    }, AUTO_SCROLL_MS);
  }, [statistics.length, scrollToNext, stopAutoScroll]);

  /** רק כשמספר הכרטיסיות משתנה — לא כל רינדור (המערך מתחדש כל פעם מההורה) */
  useEffect(() => {
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    stopAutoScroll();
    if (statistics.length > 1) {
      startAutoScroll();
    }
    return () => stopAutoScroll();
  }, [statistics.length, startAutoScroll, stopAutoScroll]);

  const handleScrollEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      syncIndexFromOffset(event.nativeEvent.contentOffset.x);
      isUserScrollingRef.current = false;
      startAutoScroll();
    },
    [syncIndexFromOffset, startAutoScroll]
  );

  const handleScrollBeginDrag = useCallback(() => {
    isUserScrollingRef.current = true;
    stopAutoScroll();
  }, [stopAutoScroll]);

  const renderStatCard = ({ item, index }: { item: StatisticItem; index: number }) => {
    const { snapInterval } = layout;
    const inputRange = [
      (index - 1) * snapInterval,
      index * snapInterval,
      (index + 1) * snapInterval,
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.94, 1, 0.94],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.72, 1, 0.72],
      extrapolate: 'clamp',
    });

    const cardColor = item.color || DesignTokens.colors.primary.main;
    const isPositive = typeof item.value === 'number' ? item.value >= 0 : true;

    return (
      <Animated.View
        style={[
          styles.cardContainer,
          RTL_FLIP,
          {
            transform: [{ scaleX: -1 }, { scaleY: scale }],
            opacity,
          },
        ]}
      >
        <UICard variant="blur" padding="sm" style={styles.statCard}>
          <View style={styles.cardContent}>
            <View style={[styles.iconContainer, { backgroundColor: `${cardColor}18` }]}>
              <Ionicons name={item.icon} size={20} color={cardColor} />
            </View>

            <View style={styles.contentContainer}>
              <Text style={styles.statTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text
                style={[
                  styles.statValue,
                  typeof item.value === 'number' && !isPositive && styles.statValueNegative,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {item.value}
              </Text>
              {item.subtitle ? (
                <Text style={styles.statSubtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        </UICard>
      </Animated.View>
    );
  };

  if (statistics.length === 0) {
    return null;
  }

  const { snapInterval, sidePad } = layout;

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={flatListRef}
        data={statistics}
        keyExtractor={(item) => item.id}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        snapToAlignment="center"
        decelerationRate="fast"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
          listener: (event: { nativeEvent: { contentOffset: { x: number } } }) => {
            syncIndexFromOffset(event.nativeEvent.contentOffset.x);
          },
        })}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={16}
        renderItem={renderStatCard}
        onScrollToIndexFailed={(info) => {
          const fallback = layout.snapInterval * info.index;
          flatListRef.current?.scrollToOffset({ offset: fallback, animated: false });
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
          });
        }}
        getItemLayout={(_, index) => ({
          length: snapInterval,
          offset: snapInterval * index,
          index,
        })}
        style={[RTL_FLIP, { flexGrow: 0 }]}
        contentContainerStyle={[styles.listContent, { paddingHorizontal: sidePad }]}
      />

      {statistics.length > 1 ? (
        <View style={styles.indicatorsContainer}>
          {statistics.map((_, index) => {
            const isActive = currentIndex === index;
            return (
              <View
                key={index}
                style={[
                  styles.indicator,
                  isActive ? styles.indicatorActive : styles.indicatorInactive,
                  { backgroundColor: isActive ? DesignTokens.colors.primary.main : 'rgba(255,255,255,0.28)' },
                ]}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (
  tokens: ReturnType<typeof useDesignTokens>,
  layout: { cardWidth: number; cardSpacing: number; snapInterval: number; sidePad: number }
) =>
  StyleSheet.create({
    container: {
      marginTop: tokens.spacing.sm,
      marginBottom: tokens.spacing.xs,
    },
    listContent: {
      paddingVertical: tokens.spacing.xs,
    },
    cardContainer: {
      width: layout.cardWidth,
      marginHorizontal: layout.cardSpacing / 2,
    },
    statCard: {
      width: '100%',
      minHeight: 96,
      paddingVertical: tokens.spacing.xs,
    },
    cardContent: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    contentContainer: {
      alignItems: 'center',
      gap: 2,
      maxWidth: '100%',
    },
    statTitle: {
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
      fontWeight: tokens.typography.fontWeight.medium as any,
      lineHeight: 18,
    },
    statValue: {
      fontSize: 26,
      fontWeight: tokens.typography.fontWeight.bold as any,
      color: tokens.colors.text.primary,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    statValueNegative: {
      color: tokens.colors.text.danger,
    },
    statSubtitle: {
      fontSize: tokens.typography.fontSize.xs,
      color: tokens.colors.text.tertiary,
      textAlign: 'center',
      marginTop: 2,
    },
    indicatorsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: tokens.spacing.sm,
      gap: 6,
    },
    indicator: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    indicatorActive: {
      transform: [{ scale: 1.15 }],
    },
    indicatorInactive: {
      opacity: 0.55,
    },
  });
