import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { SUGGESTED_WATCHLIST_SYMBOLS } from '../../../services/watchlist/watchlistTypes';
import { HapticFeedback } from '../../../utils/hapticFeedback';

type Props = {
  onAddPress: () => void;
  onSuggest: (symbol: string, name: string) => void;
};

export function WatchlistEmpty({ onAddPress, onSuggest }: Props) {
  const tokens = useDesignTokens();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { paddingBottom: 8 },
        hero: {
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 28,
          paddingBottom: 20,
          gap: 8,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: tokens.colors.border.divider,
        },
        iconWrap: {
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.colors.primary.dim,
          marginBottom: 4,
        },
        title: {
          color: tokens.colors.text.primary,
          fontSize: 17,
          fontWeight: '800',
          textAlign: 'center',
          writingDirection: 'rtl',
        },
        subtitle: {
          color: tokens.colors.text.tertiary,
          fontSize: 13,
          lineHeight: 19,
          textAlign: 'center',
          writingDirection: 'rtl',
        },
        cta: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 6,
          marginTop: 8,
          backgroundColor: tokens.colors.primary.main,
          paddingHorizontal: 16,
          paddingVertical: 11,
          borderRadius: tokens.borderRadius.button,
        },
        ctaText: {
          color: tokens.colors.text.inverse,
          fontSize: 14,
          fontWeight: '800',
        },
        suggestHeader: {
          paddingHorizontal: 14,
          paddingTop: 14,
          paddingBottom: 6,
        },
        suggestLabel: {
          color: tokens.colors.text.tertiary,
          fontSize: 12,
          fontWeight: '700',
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        suggestRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 11,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: tokens.colors.border.divider,
          gap: 10,
        },
        suggestText: {
          flex: 1,
          alignItems: 'flex-end',
          gap: 2,
        },
        suggestSymbol: {
          color: tokens.colors.text.primary,
          fontSize: 14,
          fontWeight: '700',
          textAlign: 'right',
        },
        suggestName: {
          color: tokens.colors.text.tertiary,
          fontSize: 11,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        addHint: {
          color: tokens.colors.primary.main,
          fontSize: 13,
          fontWeight: '700',
        },
      }),
    [tokens]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.iconWrap}>
          <Ionicons name="eye-outline" size={26} color={tokens.colors.primary.main} />
        </View>
        <Text style={styles.title}>הרשימה ריקה</Text>
        <Text style={styles.subtitle}>
          הוסיפו מניות למעקב — מחיר חי ושינוי יומי ($ / %)
        </Text>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => {
            void HapticFeedback.selection();
            onAddPress();
          }}
        >
          <Ionicons name="add" size={18} color={tokens.colors.text.inverse} />
          <Text style={styles.ctaText}>הוספת סימבול</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.suggestHeader}>
        <Text style={styles.suggestLabel}>הוספה מהירה</Text>
      </View>
      {SUGGESTED_WATCHLIST_SYMBOLS.slice(0, 6).map((s) => (
        <TouchableOpacity
          key={s.symbol}
          style={styles.suggestRow}
          onPress={() => {
            void HapticFeedback.selection();
            onSuggest(s.symbol, s.name);
          }}
        >
          <TickerLogo symbol={s.symbol} size={28} />
          <View style={styles.suggestText}>
            <Text style={styles.suggestSymbol}>{s.symbol}</Text>
            <Text style={styles.suggestName}>{s.name}</Text>
          </View>
          <Text style={styles.addHint}>הוסף</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
