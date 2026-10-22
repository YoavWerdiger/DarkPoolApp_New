/**
 * שיט פירוט דוח רווח — לפי הטופו: הכרטיס של רשימת הדוחות (עם פס הצבע, «מכה» / «מפספסת» מתחת לערכים)
 * ומתחתיו גרף TradingView בטיים־פריים נמוך עם מסחר מורחב — התנודה של המניה בגלל הדוח.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { appGroupLabelStyle } from '../../components/ui/appType';
import { DayNavBlurButton, HEADER_BACK_BTN_SIZE } from '../../components/ui/DayNavBlurButton';
import { MarketsTradingView } from '../Markets/components/MarketsTradingView';
import { getTradingViewEarningsChartHTML } from '../Markets/embeds/tradingViewEmbeds';
import { useTheme } from '../../context/ThemeContext';
import { HapticFeedback } from '../../utils/hapticFeedback';
import type { EarningsReport } from '../../services/earningsService';

const SHEET_SNAP = 0.92;
const CHART_HEIGHT = 280;

type Props = {
  visible: boolean;
  report: EarningsReport | null;
  /** הכרטיס מרשימת הדוחות (מועבר מהמסך — בלי import מעגלי) */
  card: React.ReactNode;
  onClose: () => void;
  /** שיתוף הדוח (צ׳אט / ציוצים) — ההורה סוגר את השיט ופותח את שיט השיתוף */
  onShare?: (report: EarningsReport) => void;
};

function symbolOf(report: EarningsReport): string {
  return (report.ticker || (report.code || '').replace(/\.US$/i, '') || '').trim().toUpperCase();
}

export default function EarningsDetailSheet({ visible, report, card, onClose, onShare }: Props) {
  const tokens = useDesignTokens();
  return (
    <BottomSheet
      isOpen={visible && !!report}
      onClose={onClose}
      snapPoints={[SHEET_SNAP]}
      fitContent
      edgeToEdge
      showHandle
      enablePanDownToClose
      useModal
      showBrandBackground={false}
      showBrandWatermark={false}
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
      contentPaddingBottom={0}
    >
      {report ? <Body report={report} card={card} onClose={onClose} onShare={onShare} /> : null}
    </BottomSheet>
  );
}

function Body({
  report,
  card,
  onClose,
  onShare,
}: {
  report: EarningsReport;
  card: React.ReactNode;
  onClose: () => void;
  onShare?: (report: EarningsReport) => void;
}) {
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const symbol = symbolOf(report);

  const chartHtml = useMemo(
    () => getTradingViewEarningsChartHTML(symbol, report.report_date, isDarkMode),
    [symbol, report.report_date, isDarkMode],
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <DayNavBlurButton
          glass
          glassIntensity="light"
          onPress={onClose}
          size={HEADER_BACK_BTN_SIZE}
          accessibilityLabel="סגור"
        >
          <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
        </DayNavBlurButton>
        <View style={styles.topSpacer} />
        {onShare ? (
          <DayNavBlurButton
            glass
            glassIntensity="light"
            onPress={() => {
              void HapticFeedback.selection();
              onShare(report);
            }}
            size={HEADER_BACK_BTN_SIZE}
            accessibilityLabel="שיתוף"
          >
            <Ionicons name="share-outline" size={20} color={tokens.colors.text.primary} />
          </DayNavBlurButton>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        showsVerticalScrollIndicator={false}
      >
        {/* הכרטיס מגיע עם ריפוד הצד של המסך */}
        {card}

        <View style={styles.chartBlock}>
          <Text style={styles.groupHeading}>תנועת המניה</Text>
          <UICard variant="soft" glassIntensity="subtle" padding="none" style={styles.chartCard}>
            <MarketsTradingView
              html={chartHtml}
              instanceKey={`earnings-sheet-${symbol}-${report.id}`}
              height={CHART_HEIGHT}
              loadingBackgroundColor="transparent"
            />
          </UICard>
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles() {
  const tokens = useDesignTokens();
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, minHeight: 0 },
        topBar: {
          direction: 'rtl',
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: HEADER_BACK_BTN_SIZE,
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          paddingTop: 10,
          paddingBottom: APP_LAYOUT.stackGapSmall + 4,
        },
        topSpacer: { flex: 1 },
        scroll: { flex: 1, minHeight: 0 },
        chartBlock: {
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
        },
        chartCard: {
          overflow: 'hidden',
          borderRadius: tokens.borderRadius.xl,
        },
        groupHeading: {
          ...appGroupLabelStyle,
          color: tokens.colors.text.secondary,
        },
      }),
    [tokens],
  );
}
