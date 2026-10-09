/**
 * שיט דרגת ותק — אייקון גדול + שם, ותק המנוי, התקדמות לדרגה הבאה, הסולם המלא, «הבנתי».
 * אותה טופולוגיה כמו HelpSheet.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, {
  BOTTOM_SHEET_EDGE_HANDLE_HEIGHT,
  useBottomSheetClose,
} from '../BottomSheet/BottomSheet';
import UIButton from '../UIButton';
import { useDesignTokens } from '../DesignTokens';
import { APP_LAYOUT } from '../appLayout';
import {
  APP_TYPE,
  appBodyTextStyle,
  appCaptionStyle,
  appSheetTitleStyle,
} from '../appType';
import { HELP_SHEET_GOT_IT } from '../HelpSheet';
import { useTheme } from '../../../context/ThemeContext';
import { RankAnimalIcon } from './RankAnimalIcon';
import {
  USER_RANK_LADDER,
  formatDaysCount,
  formatPaidTenure,
  rankColor,
  rankProgress,
} from './userRank';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const HERO_ICON = 56;
const ROW_ICON = 22;

type Props = {
  visible: boolean;
  onClose: () => void;
  paidDays: number;
};

function RankSheetBody({
  paidDays,
  onClose,
  onLayout,
}: {
  paidDays: number;
  onClose: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const animatedClose = useBottomSheetClose();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const info = rankProgress(paidDays);

  const dismiss = useCallback(() => {
    if (animatedClose) {
      animatedClose();
      return;
    }
    onClose();
  }, [animatedClose, onClose]);

  if (!info) return null;
  const gray = tokens.colors.text.tertiary;
  const color = rankColor(info.rank.metal, isDarkMode, gray);

  return (
    <View onLayout={onLayout} style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
      <View style={styles.hero}>
        <RankAnimalIcon animal={info.rank.animal} color={color} size={HERO_ICON} />
        {/* בלי שמות דרגות — האייקון והוותק מספרים את הסיפור */}
        <Text style={[styles.title, { color: tokens.colors.text.primary }]}>
          {formatPaidTenure(paidDays)}
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: tokens.colors.border.divider }]}>
        <View style={[styles.fill, { width: `${Math.round(info.progress * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.progressLabel, { color: tokens.colors.text.secondary }]}>
        {info.next && info.daysToNext != null
          ? `עוד ${formatDaysCount(info.daysToNext)} לדרגה הבאה`
          : 'הגעת לדרגה הגבוהה ביותר'}
      </Text>

      <View style={styles.ladder}>
        {USER_RANK_LADDER.map((r) => {
          const active = r.level === info.rank.level;
          const reached = paidDays >= r.minDays;
          return (
            <View
              key={r.level}
              style={[styles.ladderRow, active && { backgroundColor: tokens.colors.selection.subtle }]}
            >
              <View style={{ opacity: reached ? 1 : 0.4 }}>
                <RankAnimalIcon animal={r.animal} color={rankColor(r.metal, isDarkMode, gray)} size={ROW_ICON} />
              </View>
              <Text
                style={[
                  styles.ladderName,
                  { color: active ? tokens.colors.text.primary : tokens.colors.text.secondary },
                  active && { fontWeight: APP_TYPE.cardTitle.fontWeight },
                ]}
                numberOfLines={1}
              >
                {r.rangeLabel}
              </Text>
            </View>
          );
        })}
      </View>

      <UIButton title={HELP_SHEET_GOT_IT} variant="primary" size="lg" fullWidth onPress={dismiss} />
    </View>
  );
}

export function RankSheet({ visible, onClose, paidDays }: Props) {
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  useEffect(() => {
    setContentHeight(null);
  }, [paidDays]);

  const onContentLayout = useCallback((e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height;
    if (height > 0) setContentHeight((prev) => (prev === height ? prev : height));
  }, []);

  const snapPoint = useMemo(() => {
    if (contentHeight != null && contentHeight > 0) {
      const totalPx = contentHeight + BOTTOM_SHEET_EDGE_HANDLE_HEIGHT + 4;
      return Math.min(0.9, Math.max(0.3, totalPx / SCREEN_HEIGHT));
    }
    return 0.7;
  }, [contentHeight]);

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[snapPoint]}
      fitContent
      edgeToEdge
      showHandle
      enablePanDownToClose
      useModal
      showBrandBackground={false}
    >
      <RankSheetBody paidDays={paidDays} onClose={onClose} onLayout={onContentLayout} />
    </BottomSheet>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      alignSelf: 'stretch',
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingTop: 6,
      direction: 'rtl',
    },
    hero: {
      alignItems: 'center',
      marginBottom: 18,
    },
    title: {
      ...appSheetTitleStyle,
      textAlign: 'center',
      marginTop: 10,
    },
    tenure: {
      ...appBodyTextStyle,
      textAlign: 'center',
      marginTop: 2,
    },
    track: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      // התקדמות מתמלאת מימין
      flexDirection: 'row',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
    },
    progressLabel: {
      ...appCaptionStyle,
      marginTop: 8,
      marginBottom: 16,
    },
    ladder: {
      marginBottom: 20,
    },
    ladderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderRadius: tokens.borderRadius.md,
    },
    ladderName: {
      ...appBodyTextStyle,
      flex: 1,
      minWidth: 0,
    },
    ladderRange: {
      ...appCaptionStyle,
    },
  });
}
