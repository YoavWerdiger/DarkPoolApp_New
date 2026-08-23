import React, { useCallback, useState } from 'react';
import { Calendar, List } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import EarningsReportsTab, { type EarningsViewMode } from './EarningsReportsTab';
import { NewsScreenShell } from './NewsScreenShell';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

/** מסך מגירה — דיווחי רווח (בלי טאבים בתוך חדשות) */
export default function NewsEarningsScreen() {
  const DesignTokens = useDesignTokens();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const [viewMode, setViewMode] = useState<EarningsViewMode>('daily');

  const openReportId =
    typeof route.params?.earningsReportId === 'string'
      ? route.params.earningsReportId
      : null;
  const openTicker =
    typeof route.params?.ticker === 'string' ? route.params.ticker : null;
  const openReportDate =
    typeof route.params?.reportDate === 'string' ? route.params.reportDate : null;

  const handleOpenReportConsumed = useCallback(() => {
    (navigation as any).setParams?.({
      earningsReportId: undefined,
      ticker: undefined,
      reportDate: undefined,
    });
  }, [navigation]);

  const toggleViewMode = useCallback(() => {
    void HapticFeedback.selection();
    setViewMode((prev) => (prev === 'daily' ? 'weekly' : 'daily'));
  }, []);

  const isWeekly = viewMode === 'weekly';
  const iconColor = DesignTokens.colors.text.primary;

  /** כפתור תצוגה יומי/שבועי — אותו DayNavBlurButton + גודל כמו כפתור התפריט */
  const viewModeButton = (
    <DayNavBlurButton
      onPress={toggleViewMode}
      glassIntensity="subtle"
      size={DRAWER_MENU_BUTTON_SIZE}
      accessibilityLabel={isWeekly ? 'מעבר לתצוגה יומית' : 'מעבר לתצוגה שבועית'}
    >
      {isWeekly ? (
        <List size={22} strokeWidth={2} color={iconColor} />
      ) : (
        <Calendar size={22} strokeWidth={2} color={iconColor} />
      )}
    </DayNavBlurButton>
  );

  return (
    <NewsScreenShell title="דיווחי רווח" headerRight={viewModeButton}>
      <EarningsReportsTab
        viewMode={viewMode}
        openReportId={openReportId}
        openTicker={openTicker}
        openReportDate={openReportDate}
        onOpenReportConsumed={handleOpenReportConsumed}
      />
    </NewsScreenShell>
  );
}
