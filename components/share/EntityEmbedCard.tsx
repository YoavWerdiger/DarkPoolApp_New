import React, { useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_TYPE } from '../ui/appType';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../ui/appLayout';
import type { ShareableAttachment } from '../../types/shareableEntity';
import { PREVIEW_METRIC_LABELS } from '../../types/shareableEntity';
import {
  canOpenShareableEntity,
  openShareableEntity,
} from '../../lib/openShareableEntity';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { brandfetchTickerLogoUri } from '../../utils/brandfetch';
import { TickerLogo } from '../ui/TickerLogo';
import { PortfolioSharePreview } from './PortfolioSharePreview';

type Props = {
  attachment: ShareableAttachment;
  onPress?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
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

  const hasHoldingsChart =
    attachment.ref.type === 'person_profile' &&
    (attachment.preview.holdingsChart?.length ?? 0) >= 2;

  const preferredByType: Record<string, string[]> = {
    person_profile: hasHoldingsChart
      ? ['top_holding', 'top_holding_value']
      : ['portfolio_value', 'top_holding', 'top_holding_value'],
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
            fontWeight: '700',
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

export default function EntityEmbedCard({ attachment, onPress, compact, style }: Props) {
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

  const portfolioShareValue =
    isPerson && preview.metrics?.portfolio_value != null
      ? String(preview.metrics.portfolio_value)
      : null;
  const personInitial =
    (preview.title ?? '').trim()[0]?.toUpperCase() || '?';

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handlePress}
      style={[styles.card, style]}
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

        {isPerson ? (
          <PortfolioSharePreview
            compact={isCompact}
            portfolioValueLabel={portfolioShareValue}
            holdingsChart={preview.holdingsChart}
            avatarUrl={preview.imageUrl}
            userInitial={personInitial}
          />
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
              size={14}
              color={tokens.colors.text.secondary}
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
  return StyleSheet.create({
    /**
     * Yoga הגלובלי הוא LTR. row-reverse שם אווטאר/טקסט לימין.
     * direction:'ltr' כאן מבודד מהורה rtl (קומפוז/ציוצים) — בלי היפוך כפול.
     */
    card: {
      direction: 'ltr',
      overflow: 'hidden',
      borderRadius: UI_CARD_RADIUS,
      borderWidth: 0,
      backgroundColor: `${tokens.colors.text.primary}0F`,
    },
    heroWrap: {
      width: '100%',
      aspectRatio: 16 / 9,
      maxHeight: compact ? 160 : 200,
      backgroundColor: tokens.colors.background.tertiary,
      overflow: 'hidden',
      borderTopLeftRadius: UI_CARD_RADIUS,
      borderTopRightRadius: UI_CARD_RADIUS,
    },
    heroImage: {
      width: '100%',
      height: '100%',
      borderTopLeftRadius: UI_CARD_RADIUS,
      borderTopRightRadius: UI_CARD_RADIUS,
    },
    main: {
      paddingVertical: compact ? APP_LAYOUT.cardTitleToBodyGap : APP_LAYOUT.cardPadding,
      paddingHorizontal: APP_LAYOUT.cardPadding,
      gap: APP_LAYOUT.cardTitleToBodyGap,
    },
    headerRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 12,
    },
    tradeLogoWrap: {
      borderRadius: Math.round((compact ? 48 : 60) * 0.28),
      overflow: 'hidden',
      borderWidth: 0,
      backgroundColor: '#FFFFFF',
    },
    headerText: {
      flex: 1,
      minWidth: 0,
      gap: 0,
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
      backgroundColor: `${tokens.colors.text.danger}2E`,
    },
    sideChipText: {
      ...APP_TYPE.cardMetricLabel,
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
      ...APP_TYPE.cardTitle,
      color: tokens.colors.text.primary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    subtitle: {
      ...APP_TYPE.cardSubtitle,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    snippet: {
      ...APP_TYPE.cardSubtitle,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    metricsRow: {
      flexDirection: 'row-reverse',
      alignItems: 'stretch',
      borderTopWidth: 1,
      borderTopColor: tokens.colors.border.divider,
      paddingTop: 4,
    },
    /** גריד 2 עמודות לטרייד מורחב — כמו TradeListCard, בלי דחיסה */
    metricsGrid: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 12,
      columnGap: 8,
      width: '100%',
      paddingTop: APP_LAYOUT.cardTitleToBodyGap,
      borderTopWidth: 1,
      borderTopColor: tokens.colors.border.divider,
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
      paddingVertical: 8,
      paddingHorizontal: 6,
      gap: APP_LAYOUT.cardMetricLabelToValueGap,
      alignItems: 'center',
      minWidth: 0,
    },
    metricDivider: {
      width: 1,
      marginVertical: 8,
      backgroundColor: tokens.colors.border.divider,
    },
    metricLabel: {
      ...APP_TYPE.cardMetricLabel,
      color: tokens.colors.text.secondary,
      writingDirection: 'rtl',
      textAlign: 'center',
    },
    metricValue: {
      ...APP_TYPE.cardBody,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      writingDirection: 'ltr',
      textAlign: 'center',
    },
    metricValueExpanded: {},
    footer: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 2,
      width: '100%',
      alignSelf: 'stretch',
    },
    expandHint: {
      ...APP_TYPE.caption,
      color: tokens.colors.text.secondary,
      writingDirection: 'rtl',
      textAlign: 'right',
    },
  });
}
