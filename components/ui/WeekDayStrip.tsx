/**
 * פס ימי מסחר (ב׳–ו׳) במקום ניווט יום בחצים — יומן כלכלי ודיווחי רווח.
 * כל השבוע במבט אחד, הקשה אחת ליום; רקע ירוק שמחליק ליום הנבחר.
 * נקודה מתחת למספר = יש נתונים ביום (markedDates). החלקה הצידה / חצים — שבוע קודם / הבא.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useDesignTokens } from './DesignTokens';
import { APP_TYPE } from './appType';
import { HapticFeedback } from '../../utils/hapticFeedback';

const HEB_WEEKDAY = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const GAP = 6;
const SLIDE = { duration: 260, easing: Easing.out(Easing.cubic) };

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ב׳–ו׳ של השבוע של התאריך; שבת → השבוע שהסתיים, ראשון → השבוע שמתחיל */
function tradingWeek(anchor: Date): Date[] {
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12);
  const dow = d.getDay(); // 0=א׳
  const toMonday = dow === 0 ? 1 : dow === 6 ? -5 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + toMonday);
  return Array.from({ length: 5 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return x;
  });
}

type Props = {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  /** ימים עם נתונים (YYYY-MM-DD מקומי) — נקודה קטנה מתחת למספר */
  markedDates?: ReadonlySet<string>;
};

export function WeekDayStrip({ selectedDate, onSelect, markedDates }: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const days = useMemo(() => tradingWeek(selectedDate), [selectedDate]);
  const todayKey = dayKey(new Date());
  const selKey = dayKey(selectedDate);
  const selIndex = days.findIndex((d) => dayKey(d) === selKey);

  // רקע נבחר מחליק: RTL — ב׳ בימין (אינדקס 0 = הכי ימני)
  const [rowW, setRowW] = useState(0);
  const cellW = rowW > 0 ? (rowW - GAP * 4) / 5 : 0;
  const thumbX = useSharedValue(0);
  const thumbOn = useSharedValue(0);
  useEffect(() => {
    if (!cellW) return;
    if (selIndex < 0) {
      thumbOn.value = withTiming(0, SLIDE);
      return;
    }
    const x = (4 - selIndex) * (cellW + GAP);
    if (thumbOn.value === 0) thumbX.value = x;
    else thumbX.value = withTiming(x, SLIDE);
    thumbOn.value = withTiming(1, SLIDE);
  }, [selIndex, cellW, thumbX, thumbOn]);
  const thumbStyle = useAnimatedStyle(() => ({
    opacity: thumbOn.value,
    transform: [{ translateX: thumbX.value }],
  }));

  const shiftWeek = (dir: 1 | -1) => {
    void HapticFeedback.selection();
    const base = days[Math.max(0, selIndex)] ?? days[0];
    const next = new Date(base);
    next.setDate(base.getDate() + dir * 7);
    onSelect(next);
  };

  // החלקה: ימינה → שבוע קודם (RTL), שמאלה → שבוע הבא
  const swipe = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-14, 14])
    .onEnd((e) => {
      if (Math.abs(e.translationX) < 50) return;
      runOnJS(shiftWeek)(e.translationX > 0 ? -1 : 1);
    });

  const onRowLayout = (e: LayoutChangeEvent) => setRowW(e.nativeEvent.layout.width);

  return (
    <GestureDetector gesture={swipe}>
      <View style={styles.row} onLayout={onRowLayout}>
        {/* שכבה 1: אריחים אפורים קבועים · שכבה 2: הרקע הירוק שמחליק מעליהם · שכבה 3: הטקסט */}
        <View style={[StyleSheet.absoluteFill, styles.row]} pointerEvents="none">
          {days.map((d) => (
            <View key={dayKey(d)} style={[styles.tile, { backgroundColor: tokens.colors.background.cardSolid }]} />
          ))}
        </View>
        {cellW > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.thumb, { width: cellW, backgroundColor: tokens.colors.primary.main }, thumbStyle]}
          />
        ) : null}
        {days.map((d, i) => {
          const key = dayKey(d);
          const selected = i === selIndex;
          const isToday = key === todayKey;
          const marked = markedDates?.has(key);
          const numColor = selected
            ? tokens.colors.text.inverse
            : isToday
              ? tokens.colors.primary.main
              : tokens.colors.text.primary;
          return (
            <Pressable
              key={key}
              onPress={() => {
                if (selected) return;
                void HapticFeedback.selection();
                onSelect(d);
              }}
              style={styles.cell}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
            >
              <Text style={[styles.weekday, { color: selected ? tokens.colors.text.inverse : tokens.colors.text.secondary }]}>
                {HEB_WEEKDAY[d.getDay()]}
              </Text>
              <Text style={[styles.dayNum, { color: numColor }]}>{d.getDate()}</Text>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: marked
                      ? selected
                        ? tokens.colors.text.inverse
                        : tokens.colors.text.secondary
                      : 'transparent',
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </GestureDetector>
  );
}

function createStyles(_tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    row: {
      direction: 'rtl',
      flexDirection: 'row',
      gap: GAP,
    },
    tile: {
      flex: 1,
      borderRadius: 16,
    },
    thumb: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      borderRadius: 16,
    },
    cell: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 7,
    },
    weekday: {
      ...APP_TYPE.caption,
      fontWeight: '500',
      textAlign: 'center',
    },
    dayNum: {
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
      marginTop: 2,
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      marginTop: 4,
    },
  });
}
