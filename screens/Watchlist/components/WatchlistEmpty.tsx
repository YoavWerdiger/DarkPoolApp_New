import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import {
  appCardSubtitleStyle,
  appCardTitleStyle,
  appGroupLabelStyle,
  APP_TYPE,
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
        wrap: { paddingBottom: APP_LAYOUT.stackGapSmall },
        hero: {
          alignItems: 'center',
          paddingHorizontal: APP_LAYOUT.cardPadding,
          paddingTop: APP_LAYOUT.sectionGap - APP_LAYOUT.stackGapSmall,
          paddingBottom: APP_LAYOUT.componentGap + APP_LAYOUT.stackGapSmall,
          borderBottomWidth: 1,
          borderBottomColor: tokens.colors.border.divider,
        },
        iconWrap: {
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.colors.background.primary,
          marginBottom: APP_LAYOUT.componentGap,
        },
        title: {
          ...appCardTitleStyle,
          color: tokens.colors.text.primary,
          textAlign: 'center',
        },
        subtitle: {
          ...appCardSubtitleStyle,
          marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
          color: tokens.colors.text.secondary,
          textAlign: 'center',
        },
        cta: {
          marginTop: APP_LAYOUT.componentGap,
          alignSelf: 'center',
        },
        suggestHeader: {
          paddingHorizontal: APP_LAYOUT.cardPadding,
          paddingTop: APP_LAYOUT.componentGap,
        },
        suggestLabel: {
          ...appGroupLabelStyle,
          color: tokens.colors.text.secondary,
        },
        suggestRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: APP_LAYOUT.cardPadding,
          paddingVertical: APP_LAYOUT.cardTitleToBodyGap,
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
          ...APP_TYPE.cardBody,
          fontWeight: APP_TYPE.cardTitle.fontWeight,
          textAlign: 'right',
          writingDirection: 'ltr',
          color: tokens.colors.text.primary,
        },
        suggestName: {
          ...APP_TYPE.caption,
          textAlign: 'right',
          color: tokens.colors.text.secondary,
        },
        addChip: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 4,
          height: 28,
          paddingHorizontal: 12,
          borderRadius: 14,
          backgroundColor: tokens.colors.background.primary,
        },
        addHint: {
          ...APP_TYPE.cardMetricLabel,
          color: tokens.colors.text.primary,
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
            <TickerLogo symbol={s.symbol} size={32} />
          </View>
          <View style={styles.suggestText}>
            <Text style={styles.suggestSymbol}>{s.symbol}</Text>
            <Text style={styles.suggestName}>{s.name}</Text>
          </View>
          <View style={styles.addChip}>
            <Ionicons name="add" size={14} color={tokens.colors.text.primary} />
            <Text style={styles.addHint}>הוסף</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}
