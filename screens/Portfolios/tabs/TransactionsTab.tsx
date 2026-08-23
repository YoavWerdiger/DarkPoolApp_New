import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import type { PortfoliosStackParamList } from '../../../navigation/PortfoliosStack';
import type { Portfolio, PortfolioTransaction } from '../portfolioTypes';
import {
  TRANSACTION_LABELS,
} from '../portfolioConstants';
import {
  listTransactions,
  deleteTransaction,
} from '../../../services/portfolios';
import {
  formatCurrency,
  formatDateShort,
  formatNumber,
} from '../utils/format';
import { TickerLogo } from '../components/TickerLogo';
import { HapticFeedback } from '../../../utils/hapticFeedback';

interface Props {
  portfolio: Portfolio;
  onAddPress: () => void;
  /** תיק ציבורי של אחר — ללא עריכה/מחיקה */
  readOnly?: boolean;
  /** סינון לפי סוגי טרנזקציה — אם לא מוגדר מציג הכל */
  typeFilter?: PortfolioTransaction['type'][];
  /** כותרת לסעיף — אם מוגדר מוצג מעל הרשימה */
  sectionTitle?: string;
  /** מפתח שמשתנה כל פעם שהמסך האב מרענן נתונים — גורם לטעינה מחדש של הטרנזקציות */
  refreshKey?: number;
}

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'PortfolioDetail'>;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TX_ICONS: Record<PortfolioTransaction['type'], IoniconName> = {
  buy: 'arrow-down-circle',
  sell: 'arrow-up-circle',
  deposit: 'log-in-outline',
  withdrawal: 'log-out-outline',
  fee: 'cash-outline',
  dividend: 'gift',
};

export default function TransactionsTab({
  portfolio,
  onAddPress,
  readOnly = false,
  typeFilter,
  sectionTitle,
  refreshKey,
}: Props) {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<PortfolioTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await listTransactions(portfolio.id, { limit: 500 });
      const filtered = typeFilter
        ? list.filter((tx) => typeFilter.includes(tx.type))
        : list;
      // הפקדות/משיכות לפני עמלות — כדי שלא ייבלעו ברשימת fees של Colmex
      const rank = (t: PortfolioTransaction['type']) =>
        t === 'deposit' || t === 'withdrawal' ? 0 : t === 'dividend' ? 1 : 2;
      filtered.sort((a, b) => {
        const rd = rank(a.type) - rank(b.type);
        if (rd !== 0) return rd;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      setItems(filtered);
    } finally {
      setLoading(false);
    }
  }, [portfolio.id, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // מרענן את רשימת הטרנזקציות כשהמסך האב טוען נתונים מחדש (לאחר הוספת/עריכת טרנזקציה)
  const refreshKeyInitialized = useRef(false);
  useEffect(() => {
    if (!refreshKeyInitialized.current) {
      refreshKeyInitialized.current = true;
      return;
    }
    void load();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = useCallback(
    (tx: PortfolioTransaction) => {
      Alert.alert(
        'מחיקת טרנזקציה',
        'הפעולה תעדכן את הסיכומים בתיק. האם להמשיך?',
        [
          { text: 'ביטול', style: 'cancel' },
          {
            text: 'מחק',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteTransaction(tx.id);
                await load();
              } catch {
                Alert.alert('שגיאה', 'מחיקה נכשלה');
              }
            },
          },
        ]
      );
    },
    [load]
  );

  const handleEdit = useCallback(
    (tx: PortfolioTransaction) => {
      const initialMode =
        tx.type === 'buy' || tx.type === 'sell'
          ? 'asset'
          : tx.type === 'dividend'
          ? 'dividend'
          : 'cash';
      navigation.navigate('AddTransaction', {
        portfolioId: portfolio.id,
        initialMode,
        transactionId: tx.id,
      });
    },
    [navigation, portfolio.id]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        empty: {
          alignItems: 'center',
          paddingVertical: 50,
        },
        emptyTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          marginTop: 12,
        },
        emptyText: {
          fontSize: 13,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          paddingHorizontal: 30,
          marginTop: 4,
          lineHeight: 18,
        },
        emptyBtn: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 12,
          paddingHorizontal: 20,
          backgroundColor: tokens.colors.primary.main,
          borderRadius: 28,
          marginTop: 18,
        },
        emptyBtnText: {
          fontSize: 14,
          fontWeight: '700',
          color: tokens.colors.text.inverse,
        },
        row: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingVertical: 10,
          paddingHorizontal: 14,
          gap: 12,
        },
        iconWrap: {
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
        },
        rowMain: {
          flex: 1,
          justifyContent: 'center',
        },
        rowSide: {
          justifyContent: 'center',
          alignItems: 'flex-start',
        },
        rowTitle: {
          fontSize: 14,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          lineHeight: 18,
          textAlign: 'right',
        },
        rowSub: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          marginTop: 2,
          lineHeight: 14,
          textAlign: 'right',
        },
        rowAmount: {
          fontSize: 13,
          fontWeight: '700',
          lineHeight: 16,
          textAlign: 'left',
        },
        rowDate: {
          fontSize: 11,
          color: tokens.colors.text.tertiary,
          marginTop: 2,
          lineHeight: 14,
          textAlign: 'left',
        },
      }),
    [tokens]
  );

  if (loading) {
    return (
      <View style={{ paddingVertical: 50, alignItems: 'center' }}>
        <ActivityIndicator color={tokens.colors.primary.main} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons
          name="document-text-outline"
          size={42}
          color={tokens.colors.text.tertiary}
        />
        <Text style={styles.emptyTitle}>אין טרנזקציות</Text>
        <Text style={styles.emptyText}>
          {readOnly
            ? 'בתיק הזה אין טרנזקציות להצגה או שאין גישה לרשימה.'
            : 'הוסף עסקה ראשונה (קנייה / הפקדה) כדי לראות אותה כאן.'}
        </Text>
        {!readOnly ? (
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => {
              void HapticFeedback.medium();
              onAddPress?.();
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color={tokens.colors.text.inverse} />
            <Text style={styles.emptyBtnText}>הוסף טרנזקציה</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      {sectionTitle ? (
        <Text style={{
          fontSize: 14,
          fontWeight: '700',
          color: tokens.colors.text.secondary,
          textAlign: 'right',
          marginBottom: 12,
          paddingHorizontal: 4,
        }}>
          {sectionTitle}
        </Text>
      ) : null}
      {items.map((tx) => {
        const isBuy = tx.type === 'buy';
        const isSell = tx.type === 'sell';
        const isCashOut = tx.type === 'withdrawal' || tx.type === 'fee';
        const isCashIn =
          tx.type === 'deposit' || tx.type === 'dividend';
        const iconColor = isBuy
          ? tokens.colors.primary.main
          : isSell
          ? tokens.colors.text.danger
          : isCashIn
          ? tokens.colors.primary.main
          : isCashOut
          ? tokens.colors.text.warning
          : tokens.colors.text.secondary;

        const amount = (() => {
          if (tx.type === 'buy' || tx.type === 'sell') {
            return formatCurrency(
              Number(tx.quantity ?? 0) * Number(tx.price ?? 0),
              tx.currency
            );
          }
          return formatCurrency(Number(tx.amount ?? 0), tx.currency);
        })();

        const subtitle = (() => {
          if (tx.type === 'buy' || tx.type === 'sell') {
            return `${tx.symbol} · ${formatNumber(
              Number(tx.quantity ?? 0),
              4
            )} × ${formatCurrency(Number(tx.price ?? 0), tx.currency, 2)}`;
          }
          if (tx.type === 'dividend') {
            return `${tx.symbol} · דיבידנד`;
          }
          return tx.notes || TRANSACTION_LABELS[tx.type];
        })();

        return (
          <UICard
            key={tx.id}
            variant="glass"
            glassIntensity="light"
            padding="none"
            style={{ borderRadius: 16, marginBottom: 8, overflow: 'hidden' }}
          >
            <TouchableOpacity
              style={styles.row}
              onLongPress={
                readOnly
                  ? undefined
                  : () => {
                      void HapticFeedback.medium();
                      handleDelete(tx);
                    }
              }
              onPress={
                readOnly
                  ? undefined
                  : () => {
                      void HapticFeedback.impactLight();
                      handleEdit(tx);
                    }
              }
              activeOpacity={readOnly ? 1 : 0.85}
              disabled={readOnly}
            >
              {tx.symbol && (tx.type === 'buy' || tx.type === 'sell' || tx.type === 'dividend') ? (
                <TickerLogo symbol={tx.symbol} size={36} />
              ) : (
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: `${iconColor}20` },
                  ]}
                >
                  <Ionicons name={TX_ICONS[tx.type]} size={18} color={iconColor} />
                </View>
              )}
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{TRANSACTION_LABELS[tx.type]}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {subtitle}
                </Text>
              </View>
              <View style={styles.rowSide}>
                <Text
                  style={[
                    styles.rowAmount,
                    {
                      color: isBuy || isCashOut
                        ? tokens.colors.text.danger
                        : tokens.colors.primary.main,
                    },
                  ]}
                >
                  {(isBuy || isCashOut) ? '-' : '+'}
                  {amount}
                </Text>
                <Text style={styles.rowDate}>{formatDateShort(tx.date)}</Text>
              </View>
            </TouchableOpacity>
          </UICard>
        );
      })}
    </View>
  );
}
