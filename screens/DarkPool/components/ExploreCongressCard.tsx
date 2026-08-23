import React, { useMemo, useState } from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import type { CongressTradeCard } from '../../../services/darkpool/uwExploreService';

interface Props {
  trade: CongressTradeCard;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ExploreCongressCard({ trade, onPress, style }: Props) {
  const tokens = useDesignTokens();
  const [imgFailed, setImgFailed] = useState(false);
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const showPhoto = !!trade.image_url && !imgFailed;

  const body = (
    <View style={[styles.card, style]}>
      <View style={styles.top}>
        {showPhoto ? (
          <ImageBackground
            source={{ uri: trade.image_url! }}
            style={styles.avatar}
            imageStyle={styles.avatarImg}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.initials}>{initials(trade.politician_name)}</Text>
          </View>
        )}
        <View style={styles.topText}>
          <Text style={styles.name} numberOfLines={1}>
            {trade.politician_name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {trade.txn_label}
            {trade.amount_label ? ` · ${trade.amount_label}` : ''}
          </Text>
        </View>
      </View>
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.08)']}
        style={styles.tickerRow}
      >
        <TickerLogo symbol={trade.ticker} size={36} borderRadius={10} />
        <View style={styles.tickerText}>
          <Text style={styles.ticker} numberOfLines={1}>
            {trade.ticker}
          </Text>
          <Text style={styles.issuer} numberOfLines={1}>
            {trade.issuer || trade.filed_label}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.92 }}>
      {body}
    </Pressable>
  );
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    card: {
      width: 200,
      borderRadius: tokens.borderRadius['2xl'],
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
      backgroundColor: 'rgba(255,255,255,0.04)',
      overflow: 'hidden',
    },
    top: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      padding: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      overflow: 'hidden',
    },
    avatarImg: { borderRadius: 22 },
    avatarFallback: {
      backgroundColor: 'rgba(60,70,60,0.9)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: {
      fontSize: 14,
      fontWeight: '800',
      color: 'rgba(255,255,255,0.5)',
    },
    topText: { flex: 1, alignItems: 'flex-end' },
    name: {
      fontSize: 14,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
    meta: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
    },
    tickerRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    tickerText: { flex: 1, alignItems: 'flex-end' },
    ticker: {
      fontSize: 15,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
      textAlign: 'right',
    },
    issuer: {
      marginTop: 2,
      fontSize: 11,
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
    },
  });
}
