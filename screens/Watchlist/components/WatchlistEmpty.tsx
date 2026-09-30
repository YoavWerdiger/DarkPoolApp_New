import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import {
  appCardSubtitleStyle,
  appCardTitleStyle,
  appGroupLabelStyle,
} from '../../../components/ui/appType';
import UIButton from '../../../components/ui/UIButton';
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
          paddingHorizontal: APP_LAYOUT.cardPadding,
          paddingTop: 28,
          paddingBottom: 20,
          borderBottomWidth: 1,
          borderBottomColor: tokens.colors.border.divider,
        },
        iconWrap: {
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.colors.background.navChrome,
          marginBottom: APP_LAYOUT.sectionHeaderToContent,
        },
        title: {
          ...appCardTitleStyle,
          color: tokens.colors.text.primary,
          textAlign: 'center',
        },
        subtitle: {
          ...appCardSubtitleStyle,
          color: tokens.colors.text.secondary,
          textAlign: 'center',
        },
        cta: {
          marginTop: APP_LAYOUT.sectionHeaderToContent,
          alignSelf: 'center',
        },
        suggestHeader: {
          paddingHorizontal: APP_LAYOUT.cardPadding,
          paddingTop: APP_LAYOUT.sectionHeaderToContent,
        },
        suggestLabel: {
          ...appGroupLabelStyle,
          color: tokens.colors.text.secondary,
        },
        suggestRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: APP_LAYOUT.cardPadding,
          paddingVertical: 15,
        },
        suggestDivider: {
          borderBottomWidth: 1,
          borderBottomColor: tokens.colors.border.divider,
        },
        suggestLogo: {
          marginLeft: 12,
        },
        suggestText: {
          flex: 1,
          alignItems: 'flex-end',
          minWidth: 0,
        },
        suggestSymbol: {
          ...appCardTitleStyle,
          width: undefined,
          alignSelf: 'flex-end',
          color: tokens.colors.text.primary,
        },
        suggestName: {
          ...appCardSubtitleStyle,
          width: undefined,
          alignSelf: 'flex-end',
          color: tokens.colors.text.secondary,
        },
        addHint: {
          ...appCardSubtitleStyle,
          width: undefined,
          marginTop: 0,
          color: tokens.colors.text.secondary,
        },
      }),
    [tokens]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.iconWrap}>
          <Ionicons name="eye-outline" size={26} color={tokens.colors.text.primary} />
        </View>
        <Text style={styles.title}>הרשימה ריקה</Text>
        <Text style={styles.subtitle}>
          הוסיפו מניות למעקב — מחיר חי ושינוי יומי ($ / %)
        </Text>
        <UIButton
          title="הוספת סימבול"
          variant="primary"
          icon="add"
          iconPosition="right"
          style={styles.cta}
          onPress={onAddPress}
        />
      </View>

      <View style={styles.suggestHeader}>
        <Text style={styles.suggestLabel}>הוספה מהירה</Text>
      </View>
      {SUGGESTED_WATCHLIST_SYMBOLS.slice(0, 6).map((s, index, list) => (
        <TouchableOpacity
          key={s.symbol}
          style={[styles.suggestRow, index < list.length - 1 && styles.suggestDivider]}
          onPress={() => {
            void HapticFeedback.selection();
            onSuggest(s.symbol, s.name);
          }}
        >
          <View style={styles.suggestLogo}>
            <TickerLogo symbol={s.symbol} size={28} />
          </View>
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
