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
} from '../utils/format';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import {
  JOURNAL_LAYOUT,
  JOURNAL_TYPE,
  journalBodyTextStyle,
  journalPhysicalRightText,
  journalSectionTitleStyle,
} from '../../Journal/journalLayout';

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
        root: {
          direction: 'rtl',
        },
        empty: {
          alignItems: 'center',
          paddingVertical: 50,
          direction: 'rtl',
        },
        emptyTitle: {
          ...journalSectionTitleStyle,
          color: tokens.colors.text.primary,
          marginTop: 12,
          textAlign: 'center',
        },
        emptyText: {
          ...journalBodyTextStyle,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          paddingHorizontal: 30,
          marginTop: 4,
        },
        emptyBtn: {
          flexDirection: 'row',
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
          ...journalPhysicalRightText,
        },
        listCard: {
          borderRadius: UI_CARD_RADIUS,
          overflow: 'hidden',
        },
        row: {
          direction: 'rtl',
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: JOURNAL_LAYOUT.cardPadding,
          gap: 12,
        },
        rowDivider: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: tokens.colors.border.divider,
        },
        rowMain: {
          flex: 1,
          minWidth: 0,
          alignItems: 'stretch',
        },
        rowTitle: {
          ...journalPhysicalRightText,
          fontSize: JOURNAL_TYPE.cardSubtitle.fontSize,
          fontWeight: '600',
          lineHeight: JOURNAL_TYPE.cardSubtitle.lineHeight,
          color: tokens.colors.text.primary,
        },
        rowDate: {
          ...journalPhysicalRightText,
          marginTop: 2,
          fontSize: JOURNAL_TYPE.caption2.fontSize,
          fontWeight: JOURNAL_TYPE.caption2.fontWeight,
          lineHeight: JOURNAL_TYPE.caption2.lineHeight,
          color: tokens.colors.text.tertiary,
        },
        rowAmount: {
          flexShrink: 0,
          direction: 'ltr',
          writingDirection: 'ltr',
          textAlign: 'left',
          fontSize: JOURNAL_TYPE.cardSubtitle.fontSize,
          fontWeight: '600',
          lineHeight: JOURNAL_TYPE.cardSubtitle.lineHeight,
          color: tokens.colors.text.primary,
          fontVariant: ['tabular-nums'],
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
    <View style={styles.root}>
      {sectionTitle ? (
        <Text style={{
          ...journalPhysicalRightText,
          fontSize: JOURNAL_TYPE.groupLabel.fontSize,
          fontWeight: JOURNAL_TYPE.groupLabel.fontWeight,
          lineHeight: JOURNAL_TYPE.groupLabel.lineHeight,
          color: tokens.colors.text.secondary,
          marginTop: JOURNAL_LAYOUT.sectionGap,
          marginBottom: JOURNAL_LAYOUT.groupLabelToContent,
          paddingHorizontal: 4,
        }}>
          {sectionTitle}
        </Text>
      ) : null}
      <UICard variant="soft" padding="none" style={styles.listCard}>
        {items.map((tx, index) => {
          const isOut = tx.type === 'buy' || tx.type === 'withdrawal' || tx.type === 'fee';
          const raw =
            tx.type === 'buy' || tx.type === 'sell'
              ? Number(tx.quantity ?? 0) * Number(tx.price ?? 0)
              : Number(tx.amount ?? 0);
          const formatted = formatCurrency(Math.abs(raw), tx.currency);
          const amount = formatted === '—' ? formatted : `${isOut ? '−' : '+'}${formatted}`;
          const title =
            tx.type === 'dividend' && tx.symbol
              ? `${TRANSACTION_LABELS[tx.type]} · ${tx.symbol}`
              : TRANSACTION_LABELS[tx.type];

          return (
            <TouchableOpacity
              key={tx.id}
              style={[styles.row, index < items.length - 1 && styles.rowDivider]}
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
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.rowDate} numberOfLines={1}>
                  {formatDateShort(tx.date)}
                </Text>
              </View>
              <Text style={styles.rowAmount} numberOfLines={1}>
                {amount}
              </Text>
            </TouchableOpacity>
          );
        })}
      </UICard>
    </View>
  );
}
