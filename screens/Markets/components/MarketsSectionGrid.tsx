import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';

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
        onPress={() => onSelect(item.id)}
        activeOpacity={0.82}
        style={[styles.tileWrap, singleInRow && styles.tileWrapOrphan]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${accessibilityGroupLabel}: ${item.title}`}
      >
        <UICard
          variant="blur"
          padding="md"
          style={[
            styles.card,
            {
              borderWidth: active ? 2 : 1,
              borderColor: active ? t.colors.primary.main : t.colors.border.primary,
              backgroundColor: active ? 'rgba(0, 200, 5, 0.08)' : undefined,
            },
          ]}
        >
          <Ionicons
            name={item.icon}
            size={26}
            color={active ? t.colors.primary.main : t.colors.text.secondary}
          />
          <Text
            style={[
              styles.label,
              {
                color: active ? t.colors.text.primary : t.colors.text.secondary,
                fontWeight: active
                  ? (t.typography.fontWeight.semibold as '600')
                  : (t.typography.fontWeight.medium as '500'),
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
    gap: 10,
  },
  row: {
    flexDirection: 'row-reverse',
    gap: 10,
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
    gap: 8,
    borderRadius: 18,
  },
  label: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 18,
  },
});
