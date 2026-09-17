import React, { useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import type { ShareableAttachment } from '../../types/shareableEntity';
import { PREVIEW_METRIC_LABELS } from '../../types/shareableEntity';
import {
  canOpenShareableEntity,
  openShareableEntity,
} from '../../lib/openShareableEntity';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { brandfetchTickerLogoUri } from '../../utils/brandfetch';
import { TickerLogo } from '../ui/TickerLogo';

type Props = {
  attachment: ShareableAttachment;
  onPress?: () => void;
  compact?: boolean;
};

type MetricItem = { key: string; label: string; value: string };

function iconForType(type: ShareableAttachment['ref']['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'person_profile':
      return 'person-circle-outline';
    case 'journal_trade':
      return 'stats-chart-outline';
    case 'news_article':
      return 'newspaper-outline';
    default:
      return 'link-outline';
  }
}

function pickMetrics(
  attachment: ShareableAttachment,
  opts: { compact: boolean; expanded: boolean }
): MetricItem[] {
  const metrics = attachment.preview.metrics;
  if (!metrics) return [];

  const preferredByType: Record<string, string[]> = {
    person_profile: ['portfolio_value', 'top_holding', 'top_holding_value'],
    journal_trade: [
      'side',
      'pnl',
      'return_pct',
      'size',
      'entry',
      'exit',
      'exit_date',
      'entry_date',
      'strategy',
      'company',
    ],
    news_article: [],
  };
  const preferred =
    preferredByType[attachment.ref.type] ?? Object.keys(metrics);

  // טרייד: תמיד מציגים מספיק תוכן; ב־expand — כל המטריקות מה־snapshot
  let limit: number;
  if (attachment.ref.type === 'journal_trade') {
    limit = opts.expanded ? 8 : opts.compact ? 3 : 4;
  } else {
    limit = opts.expanded ? 6 : opts.compact ? 2 : 3;
  }

  const items: MetricItem[] = [];
  for (const key of preferred) {
    if (items.length >= limit) break;
    const raw = metrics[key];
    if (raw == null || raw === '') continue;
    items.push({
      key,
      label: PREVIEW_METRIC_LABELS[key] ?? key,
      value: String(raw),
    });
  }

  if (items.length === 0 || (opts.expanded && items.length < Object.keys(metrics).length)) {
    for (const [key, raw] of Object.entries(metrics)) {
      if (items.length >= limit) break;
      if (raw == null || raw === '') continue;
      if (items.some((i) => i.key === key)) continue;
      items.push({
        key,
        label: PREVIEW_METRIC_LABELS[key] ?? key,
        value: String(raw),
      });
    }
  }

  return items;
}

function metricValueColor(
  key: string,
  value: string,
  tokens: ReturnType<typeof useDesignTokens>
): string {
  if (key === 'pnl' || key === 'return_pct') {
    const trimmed = value.trim();
    if (/^[−\-]/.test(trimmed)) return tokens.colors.text.danger;
    if (trimmed.startsWith('+') || key === 'pnl') {
      return tokens.colors.primary.main;
    }
  }
  if (key === 'side') {
    const lower = value.toLowerCase();
    if (lower.includes('short')) return tokens.colors.text.danger;
    if (lower.includes('long')) return tokens.colors.primary.main;
  }
  return tokens.colors.text.primary;
}

function AvatarOrThumb({
  attachment,
  size,
  round,
  tokens,
}: {
  attachment: ShareableAttachment;
  size: number;
  round: boolean;
  tokens: ReturnType<typeof useDesignTokens>;
}) {
  const [failed, setFailed] = useState(false);
  const previewUri = attachment.preview.imageUrl?.trim() || null;
  const ticker =
    attachment.ref.type === 'journal_trade'
      ? attachment.ref.extras?.ticker || attachment.preview.title
      : null;
  const logoUri =
    !previewUri && ticker ? brandfetchTickerLogoUri(ticker) : null;
  const uri = !failed ? previewUri || logoUri : null;
  const radius = round
    ? size / 2
    : Math.max(tokens.borderRadius.lg, size * 0.28);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: tokens.colors.background.tertiary,
        }}
        onError={() => setFailed(true)}
      />
    );
  }

  const initial =
    ((attachment.preview.title ?? '').toString().trim()[0] || '?').toUpperCase();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: tokens.colors.primary.dim,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {attachment.ref.type === 'person_profile' ? (
        <Text
          style={{
            color: tokens.colors.primary.main,
            fontWeight: '800',
            fontSize: size * 0.38,
          }}
        >
          {initial}
        </Text>
      ) : (
        <Ionicons
          name={iconForType(attachment.ref.type)}
          size={size * 0.42}
          color={tokens.colors.primary.main}
        />
      )}
    </View>
  );
}

export default function EntityEmbedCard({ attachment, onPress, compact }: Props) {
  const tokens = useDesignTokens();
  const isCompact = !!compact;
  const [expanded, setExpanded] = useState(false);
  const styles = useMemo(() => createStyles(tokens, isCompact), [tokens, isCompact]);
  const { preview, ref } = attachment;
  const isNews = ref.type === 'news_article';
  const isPerson = ref.type === 'person_profile';
  const isTrade = ref.type === 'journal_trade';
  const metrics = useMemo(
    () => pickMetrics(attachment, { compact: isCompact, expanded }),
    [attachment, isCompact, expanded]
  );
  const heroUri = isNews ? preview.imageUrl?.trim() || null : null;
  const avatarSize = isCompact ? (isTrade ? 48 : 44) : isTrade ? 60 : isPerson ? 56 : 52;
  const avatarRound = isPerson;
  const tradeTicker =
    (ref.extras?.ticker || preview.title || '').toString().trim().toUpperCase();
  const canNavigate = canOpenShareableEntity(attachment);
  const hasExtraTradeMetrics =
    isTrade &&
    Object.keys(preview.metrics ?? {}).length > (isCompact ? 3 : 4);

  const handlePress = () => {
    void HapticFeedback.selection();
    if (onPress) {
      onPress();
      return;
    }
    // טרייד: רק expand-in-place מה־snapshot — לא ניווט ליומן ישן
    if (isTrade) {
      if (hasExtraTradeMetrics) {
        setExpanded((v) => !v);
      }
      return;
    }
    if (canNavigate) {
      openShareableEntity(attachment);
    }
  };

  const directionBadge = isTrade
    ? String(preview.badge ?? '').toUpperCase()
    : '';
  const isShort = directionBadge === 'SHORT';
  const showDirectionChip = directionBadge === 'LONG' || isShort;
  const sideChipLabel = isShort ? 'Short' : 'Long';
  /** לטרייד — בלי משפט מטא (P&L/תשואה); רק צ׳יפ Long/Short */
  const subtitleText = isTrade ? null : preview.subtitle?.trim() || null;
  const typeLabel =
    !isTrade && preview.badge?.trim() ? preview.badge.trim() : null;
  const metaLine =
    [typeLabel, subtitleText].filter(Boolean).join(' · ') || null;
  const expandHint = isTrade && hasExtraTradeMetrics
    ? expanded
      ? 'פחות'
      : 'פרטים'
    : null;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handlePress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={
        isTrade
          ? `${preview.title}, ${showDirectionChip ? sideChipLabel : ''}`
          : `${preview.title}${preview.subtitle ? `, ${preview.subtitle}` : ''}`
      }
      accessibilityState={isTrade ? { expanded } : undefined}
    >
      {heroUri ? (
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: heroUri }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        </View>
      ) : null}

      <View style={styles.main}>
        <View style={styles.headerRow}>
          {!heroUri ? (
            isTrade && tradeTicker ? (
              <View style={styles.tradeLogoWrap}>
                <TickerLogo
                  symbol={tradeTicker}
                  size={avatarSize}
                  borderRadius={Math.round(avatarSize * 0.28)}
                />
              </View>
            ) : (
              <AvatarOrThumb
                attachment={attachment}
                size={avatarSize}
                round={avatarRound}
                tokens={tokens}
              />
            )
          ) : null}

          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, isTrade ? styles.tradeTitle : null]}
                numberOfLines={isNews ? 3 : 2}
              >
                {preview.title}
              </Text>
              {showDirectionChip ? (
                <View
                  style={[
                    styles.sideChip,
                    isShort ? styles.sideChipShort : styles.sideChipLong,
                  ]}
                >
                  <Text
                    style={[
                      styles.sideChipText,
                      isShort ? styles.sideChipTextShort : styles.sideChipTextLong,
                    ]}
                  >
                    {sideChipLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            {metaLine ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {metaLine}
              </Text>
            ) : null}
          </View>
        </View>

        {preview.snippet ? (
          <Text style={styles.snippet} numberOfLines={isCompact ? 2 : 3}>
            {preview.snippet}
          </Text>
        ) : null}

        {metrics.length > 0 ? (
          expanded && isTrade ? (
            <View style={styles.metricsGrid}>
              {metrics.map((m, i) => {
                const fullWidth =
                  metrics.length % 2 === 1 && i === metrics.length - 1;
                return (
                  <View
                    key={m.key}
                    style={[
                      styles.metricGridCell,
                      fullWidth ? styles.metricGridCellFull : null,
                    ]}
                  >
                    <Text style={styles.metricLabel} numberOfLines={1}>
                      {m.label}
                    </Text>
                    <Text
                      style={[
                        styles.metricValue,
                        styles.metricValueExpanded,
                        { color: metricValueColor(m.key, m.value, tokens) },
                      ]}
                      numberOfLines={2}
                    >
                      {m.value}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.metricsRow}>
              {metrics.map((m, i) => (
                <React.Fragment key={m.key}>
                  {i > 0 ? <View style={styles.metricDivider} /> : null}
                  <View style={styles.metricCell}>
                    <Text style={styles.metricLabel} numberOfLines={1}>
                      {m.label}
                    </Text>
                    <Text
                      style={[
                        styles.metricValue,
                        { color: metricValueColor(m.key, m.value, tokens) },
                      ]}
                      numberOfLines={1}
                    >
                      {m.value}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          )
        ) : null}

        {expandHint ? (
          <View style={styles.footer}>
            <Text style={styles.expandHint}>{expandHint}</Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={tokens.colors.text.tertiary}
            />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function createStyles(
  tokens: ReturnType<typeof useDesignTokens>,
  compact: boolean
) {
  const r = tokens.borderRadius;
  return StyleSheet.create({
    /**
     * Yoga הגלובלי הוא LTR. row-reverse שם אווטאר/טקסט לימין.
     * direction:'ltr' כאן מבודד מהורה rtl (קומפוז/ציוצים) — בלי היפוך כפול.
     */
    card: {
      direction: 'ltr',
      overflow: 'hidden',
      borderRadius: r['2xl'],
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.14)',
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    heroWrap: {
      width: '100%',
      aspectRatio: 16 / 9,
      maxHeight: compact ? 160 : 200,
      backgroundColor: tokens.colors.background.tertiary,
      overflow: 'hidden',
      borderTopLeftRadius: r['2xl'],
      borderTopRightRadius: r['2xl'],
    },
    heroImage: {
      width: '100%',
      height: '100%',
      borderTopLeftRadius: r['2xl'],
      borderTopRightRadius: r['2xl'],
    },
    main: {
      paddingVertical: compact ? 10 : 12,
      paddingHorizontal: compact ? 12 : 14,
      gap: compact ? 8 : 10,
    },
    headerRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 12,
    },
    tradeLogoWrap: {
      borderRadius: Math.round((compact ? 48 : 60) * 0.28),
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.2)',
      backgroundColor: '#FFFFFF',
    },
    headerText: {
      flex: 1,
      minWidth: 0,
      gap: 4,
      alignItems: 'flex-end',
    },
    titleRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      width: '100%',
    },
    tradeTitle: {
      letterSpacing: 0.35,
      writingDirection: 'ltr',
    },
    /** צ׳יפ Long/Short — כמו TradeListCard */
    sideChip: {
      flexShrink: 0,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    sideChipLong: {
      backgroundColor: tokens.colors.primary.dim,
    },
    sideChipShort: {
      backgroundColor: 'rgba(255, 68, 68, 0.18)',
    },
    sideChipText: {
      fontSize: 11,
      fontWeight: '800',
      textAlign: 'center',
      writingDirection: 'ltr',
    },
    sideChipTextLong: {
      color: tokens.colors.primary.main,
    },
    sideChipTextShort: {
      color: tokens.colors.text.danger,
    },
    title: {
      flexShrink: 1,
      fontSize: compact ? 14 : 16,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: compact ? 18 : 22,
    },
    subtitle: {
      fontSize: compact ? 12 : 13,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: 18,
    },
    snippet: {
      fontSize: compact ? 12 : 13,
      lineHeight: compact ? 17 : 19,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    metricsRow: {
      flexDirection: 'row-reverse',
      alignItems: 'stretch',
      borderRadius: r.xl,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.08)',
      overflow: 'hidden',
    },
    /** גריד 2 עמודות לטרייד מורחב — כמו TradeListCard, בלי דחיסה */
    metricsGrid: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 12,
      columnGap: 8,
      width: '100%',
      paddingVertical: compact ? 10 : 12,
      paddingHorizontal: compact ? 10 : 12,
      borderRadius: r.xl,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    metricGridCell: {
      width: '47%',
      flexGrow: 0,
      flexShrink: 0,
      paddingVertical: 4,
      paddingHorizontal: 4,
      gap: 4,
      alignItems: 'center',
    },
    metricGridCellFull: {
      width: '100%',
      paddingTop: 4,
    },
    metricCell: {
      flex: 1,
      paddingVertical: compact ? 8 : 10,
      paddingHorizontal: 8,
      gap: 3,
      alignItems: 'center',
      minWidth: 0,
    },
    metricDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    metricLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
      textAlign: 'center',
    },
    metricValue: {
      fontSize: compact ? 12 : 13,
      fontWeight: '800',
      writingDirection: 'ltr',
      textAlign: 'center',
    },
    metricValueExpanded: {
      fontSize: compact ? 13 : 14,
      lineHeight: compact ? 17 : 19,
    },
    footer: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 2,
      width: '100%',
      alignSelf: 'stretch',
    },
    expandHint: {
      fontSize: 11,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
      textAlign: 'right',
    },
  });
}
