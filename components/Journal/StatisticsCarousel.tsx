import React, { useRef, useState, useEffect } from 'react';
import { View, Text, FlatList, Dimensions, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 64; // רוחב המסך פחות margins (הקטנתי מ-48 ל-64)
const CARD_SPACING = 12;
const SNAP_INTERVAL = CARD_WIDTH + CARD_SPACING;
const AUTO_SCROLL_INTERVAL = 3000; // 3 שניות
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
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);
  const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isUserScrollingRef = useRef(false);

  const handleScrollEnd = (event: any) => {
    // עם RTL_FLIP, contentOffset.x הוא שלילי
    const offsetX = Math.abs(event.nativeEvent.contentOffset.x);
    const index = Math.round(offsetX / SNAP_INTERVAL);
    const clampedIndex = Math.max(0, Math.min(index, statistics.length - 1));
    setCurrentIndex(clampedIndex);
    isUserScrollingRef.current = false;
    startAutoScroll();
  };

  const scrollToNext = () => {
    if (statistics.length <= 1 || isUserScrollingRef.current) return;
    
    const nextIndex = (currentIndex + 1) % statistics.length;
    setCurrentIndex(nextIndex);
    
    flatListRef.current?.scrollToIndex({
      index: nextIndex,
      animated: true,
    });
  };

  const startAutoScroll = () => {
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
    }
    
    if (statistics.length <= 1) return;
    
    autoScrollTimerRef.current = setInterval(() => {
      if (!isUserScrollingRef.current) {
        scrollToNext();
      }
    }, AUTO_SCROLL_INTERVAL);
  };

  const stopAutoScroll = () => {
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (statistics.length > 1) {
      startAutoScroll();
    }
    return () => {
      stopAutoScroll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, statistics.length]);

  const handleScrollBeginDrag = () => {
    isUserScrollingRef.current = true;
    stopAutoScroll();
  };

  const renderStatCard = ({ item, index }: { item: StatisticItem; index: number }) => {
    const inputRange = [
      (index - 1) * SNAP_INTERVAL,
      index * SNAP_INTERVAL,
      (index + 1) * SNAP_INTERVAL,
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.6, 1, 0.6],
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
        <UICard variant="blur" padding="lg" style={styles.statCard}>
          <View style={styles.cardContent}>
            <View style={[styles.iconContainer, { backgroundColor: `${cardColor}20` }]}>
              <Ionicons name={item.icon} size={28} color={cardColor} />
            </View>
            
            <View style={styles.contentContainer}>
              <Text style={styles.statTitle}>{item.title}</Text>
              <Text
                style={[
                  styles.statValue,
                  typeof item.value === 'number' && !isPositive && styles.statValueNegative,
                ]}
              >
                {item.value}
              </Text>
              {item.subtitle && (
                <Text style={styles.statSubtitle}>{item.subtitle}</Text>
              )}
            </View>
          </View>
        </UICard>
      </Animated.View>
    );
  };

  if (statistics.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={flatListRef}
        data={statistics}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_INTERVAL}
        decelerationRate="fast"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { 
            useNativeDriver: false,
            listener: (event: any) => {
              // עם RTL_FLIP, contentOffset.x הוא שלילי
              const offsetX = Math.abs(event.nativeEvent.contentOffset.x);
              const index = Math.round(offsetX / SNAP_INTERVAL);
              const clampedIndex = Math.max(0, Math.min(index, statistics.length - 1));
              if (clampedIndex !== currentIndex) {
                setCurrentIndex(clampedIndex);
              }
            }
          }
        )}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={16}
        pagingEnabled={false}
        renderItem={renderStatCard}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          });
        }}
        getItemLayout={(data, index) => ({
          length: SNAP_INTERVAL,
          offset: SNAP_INTERVAL * index,
          index,
        })}
        style={[RTL_FLIP, { flexGrow: 0 }]}
        contentContainerStyle={styles.listContent}
      />

      {/* Page Indicators */}
      {statistics.length > 1 && (
        <View style={styles.indicatorsContainer}>
          {statistics.map((_, index) => {
            const inputRange = [
              (index - 1) * SNAP_INTERVAL,
              index * SNAP_INTERVAL,
              (index + 1) * SNAP_INTERVAL,
            ];

            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.8, 1.2, 0.8],
              extrapolate: 'clamp',
            });

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.4, 1, 0.4],
              extrapolate: 'clamp',
            });

            const isActive = currentIndex === index;

            return (
              <Animated.View
                key={index}
                style={[
                  styles.indicator,
                  {
                    transform: [{ scale: isActive ? 1.2 : 0.8 }],
                    opacity: isActive ? 1 : 0.4,
                    backgroundColor: isActive
                      ? DesignTokens.colors.primary.main
                      : 'rgba(255, 255, 255, 0.3)',
                  },
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    container: {
      marginVertical: tokens.spacing.md,
    },
    listContent: {
      paddingHorizontal: (SCREEN_WIDTH - CARD_WIDTH) / 2,
      paddingVertical: tokens.spacing.sm,
    },
    cardContainer: {
      width: CARD_WIDTH,
      marginHorizontal: CARD_SPACING / 2,
    },
    statCard: {
      width: '100%',
      minHeight: 160,
      paddingVertical: tokens.spacing.lg,
    },
    cardContent: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: tokens.spacing.sm,
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    contentContainer: {
      alignItems: 'center',
      gap: tokens.spacing.xs,
    },
    statTitle: {
      fontSize: tokens.typography.fontSize.base,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
      fontWeight: tokens.typography.fontWeight.medium as any,
    },
    statValue: {
      fontSize: 42,
      fontWeight: tokens.typography.fontWeight.bold as any,
      color: tokens.colors.text.primary,
      textAlign: 'center',
      letterSpacing: -1,
    },
    statValueNegative: {
      color: tokens.colors.text.danger,
    },
    statSubtitle: {
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.text.tertiary,
      textAlign: 'center',
      marginTop: tokens.spacing.xs,
    },
    indicatorsContainer: {
      flexDirection: 'row-reverse',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: tokens.spacing.md,
      gap: 8,
    },
    indicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
  });


