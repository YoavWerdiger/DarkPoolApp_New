import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { MARKETS_LAYOUT, MARKETS_TYPE, UI_CARD_RADIUS } from '../marketsLayout';
import { HapticFeedback } from '../../../utils/hapticFeedback';

export type SectionItem = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type Props = {
  sections: SectionItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** לנגישות — ברירת מחדל לשווקים */
  accessibilityGroupLabel?: string;
};

function chunkPairs<T>(arr: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    rows.push(arr.slice(i, i + 2));
  }
  return rows;
}

/**
 * בחירת אזור — רשת 2 עמודות; שורה אחרונה עם פריט יחיד ממורכזת (כמו 3 פריטים בחדשות).
 */
export function MarketsSectionGrid({
  sections,
  activeId,
  onSelect,
  accessibilityGroupLabel = 'שווקים',
}: Props) {
  const t = useDesignTokens();
  const rows = useMemo(() => chunkPairs(sections), [sections]);

  const renderTile = (item: SectionItem, singleInRow: boolean) => {
    const active = activeId === item.id;
    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => {
          if (!active) void HapticFeedback.selection();
          onSelect(item.id);
        }}
        activeOpacity={0.82}
        style={[styles.tileWrap, singleInRow && styles.tileWrapOrphan]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${accessibilityGroupLabel}: ${item.title}`}
      >
        <UICard
          variant="soft"
          padding="md"
          style={[
            styles.card,
            { backgroundColor: t.colors.background.cardSolid },
          ]}
        >
          <Ionicons
            name={item.icon}
            size={26}
            color={active ? t.colors.text.primary : t.colors.text.secondary}
            style={styles.labelIcon}
          />
          <Text
            style={[
              styles.label,
              {
                color: active ? t.colors.text.primary : t.colors.text.secondary,
                fontWeight: active
                  ? MARKETS_TYPE.cardTitle.fontWeight
                  : MARKETS_TYPE.cardSubtitle.fontWeight,
              },
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
        </UICard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.outer}>
      {rows.map((row, idx) => (
        <View
          key={idx}
          style={[styles.row, row.length === 1 && styles.rowSingleOrphan]}
        >
          {row.map((item) => renderTile(item, row.length === 1))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  /** רוחב מלא מתחת לכותרת — מיושר לאותם קצוות כמו תוכן הטאבים */
  outer: {
    width: '100%',
    alignSelf: 'stretch',
    gap: MARKETS_LAYOUT.cardStackGap,
  },
  row: {
    flexDirection: 'row-reverse',
    gap: MARKETS_LAYOUT.cardStackGap,
  },
  /** פריט יחיד בשורה — ממורכז, רוחב כמו תא ברשת 2×2 */
  rowSingleOrphan: {
    justifyContent: 'center',
  },
  tileWrap: {
    flex: 1,
    minWidth: 0,
  },
  tileWrapOrphan: {
    flex: 0,
    width: '48%',
    maxWidth: 200,
  },
  card: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: UI_CARD_RADIUS,
  },
  labelIcon: {
    marginBottom: MARKETS_LAYOUT.stackGapSmall,
  },
  label: {
    fontSize: MARKETS_TYPE.cardSubtitle.fontSize,
    lineHeight: MARKETS_TYPE.cardSubtitle.lineHeight,
    textAlign: 'center',
  },
});
