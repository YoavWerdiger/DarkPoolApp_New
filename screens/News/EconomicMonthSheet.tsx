import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
import { appLocale } from '../../lib/i18n/locale';
import { dirIcon } from '../../lib/i18n/direction';
/**
 * לוח חודשי ליומן הכלכלי (QA 15.1) — כל יום צבוע לפי עוצמת האירועים:
 * אדום = אירוע מסומן אדום, כתום = כתום, ירוק = יש אירועים רגילים. לחיצה על יום → פותחת אותו.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import { DayNavBlurButton } from '../../components/ui/DayNavBlurButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import { HapticFeedback } from '../../utils/hapticFeedback';

export type DayTier = 'high' | 'medium' | 'low';

const TIER_COLORS: Record<DayTier, string> = {
  high: '#E5484D',
  medium: '#FF8A00',
  low: '#1FA855',
};

function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  /** YYYY-MM-DD → העוצמה הגבוהה ביום */
  dayTiers: Record<string, DayTier>;
  onSelectDate: (date: Date) => void;
};

export default function EconomicMonthSheet({ visible, onClose, selectedDate, dayTiers, onSelectDate }: Props) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [month, setMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  useEffect(() => {
    if (visible) setMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [visible, selectedDate]);

  const todayKey = dateKey(new Date());
  const selectedKey = dateKey(selectedDate);

  // שבוע מתחיל ביום ראשון (כמו בלוח העברי)
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
    for (let d = 1; d <= days; d++) out.push(new Date(month.getFullYear(), month.getMonth(), d, 12));
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const weekdayLabels = useMemo(() => {
    const base = new Date(2026, 10, 1, 12); // יום ראשון
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString(appLocale(), { weekday: 'narrow' });
    });
  }, []);

  const shiftMonth = (delta: number) => {
    void HapticFeedback.selection();
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.62]}
      fitContent
      enablePanDownToClose
      showHandle
      useModal
      showBrandBackground={false}
      edgeToEdge
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
    >
      <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.header}>
          <DayNavBlurButton onPress={() => shiftMonth(-1)} style={{ backgroundColor: tokens.colors.background.tertiary }}>
            <Ionicons name={dirIcon('chevron-back')} size={20} color={tokens.colors.text.secondary} />
          </DayNavBlurButton>
          <Text style={[styles.monthTitle, { color: tokens.colors.text.primary }]}>
            {month.toLocaleDateString(appLocale(), { month: 'long', year: 'numeric' })}
          </Text>
          <DayNavBlurButton onPress={() => shiftMonth(1)} style={{ backgroundColor: tokens.colors.success.main }}>
            <Ionicons name={dirIcon('chevron-forward')} size={20} color="#FFFFFF" />
          </DayNavBlurButton>
        </View>

        <View style={styles.row}>
          {weekdayLabels.map((l, i) => (
            <Text key={i} style={[styles.weekday, { color: tokens.colors.text.tertiary }]}>{l}</Text>
          ))}
        </View>

        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <View key={r} style={styles.row}>
            {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
              if (!d) return <View key={i} style={styles.cell} />;
              const key = dateKey(d);
              const tier = dayTiers[key];
              const color = tier ? TIER_COLORS[tier] : null;
              const isSelected = key === selectedKey;
              const isToday = key === todayKey;
              return (
                <Pressable
                  key={i}
                  style={styles.cell}
                  onPress={() => {
                    void HapticFeedback.selection();
                    onSelectDate(d);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={d.toLocaleDateString(appLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      color ? { backgroundColor: `${color}2E` } : null,
                      isToday ? { borderWidth: 1.5, borderColor: tokens.colors.text.primary } : null,
                      isSelected ? { backgroundColor: color ?? tokens.colors.text.primary } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: color ?? tokens.colors.text.primary },
                        isSelected ? { color: color ? '#FFFFFF' : tokens.colors.background.primary } : null,
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={styles.legend}>
          {(['high', 'medium', 'low'] as DayTier[]).map((t) => (
            <View key={t} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: TIER_COLORS[t] }]} />
              <Text style={[styles.legendText, { color: tokens.colors.text.secondary }]}>
                {i18n.t(`auto.screens__News__EconomicMonthSheet.${t === 'high' ? 's1' : t === 'medium' ? 's2' : 's3'}`)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: { paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal, paddingTop: 4 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    monthTitle: { ...APP_TYPE.sectionTitle, textAlign: 'center', flex: 1, writingDirection: TEXT_DIR },
    row: { flexDirection: 'row' },
    weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', marginBottom: 6 },
    cell: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
    dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    dayText: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
    legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 12 },
  });
}
