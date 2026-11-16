import i18n from '../../lib/i18n';
import React, { useCallback, useState } from 'react';
import { Calendar } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import EconomicCalendarTab from './EconomicCalendarTab';
import { NewsScreenShell } from './NewsScreenShell';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

/** מסך מגירה — יומן כלכלי (בלי טאבים בתוך חדשות) */
export default function NewsEconomicCalendarScreen() {
  const DesignTokens = useDesignTokens();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const [monthOpen, setMonthOpen] = useState(false);
  // מפוש (economic_result) — האירוע נפתח אחרי טעינה טרייה
  const openEventId = typeof route.params?.eventId === 'string' ? route.params.eventId : null;
  const handleOpenEventConsumed = useCallback(() => {
    (navigation as any).setParams?.({ eventId: undefined });
  }, [navigation]);

  /** לוח חודשי (QA 15.1) — אותו כפתור כמו התצוגה השבועית בדיווחי הרווח */
  const monthButton = (
    <DayNavBlurButton
      onPress={() => {
        void HapticFeedback.selection();
        setMonthOpen(true);
      }}
      glassIntensity="subtle"
      size={DRAWER_MENU_BUTTON_SIZE}
      accessibilityLabel={i18n.t('auto.screens__News__NewsEconomicCalendarScreen.s2')}
    >
      <Calendar size={22} strokeWidth={2} color={DesignTokens.colors.text.primary} />
    </DayNavBlurButton>
  );

  return (
    <NewsScreenShell title={i18n.t('auto.screens__News__NewsEconomicCalendarScreen.s1')} headerRight={monthButton}>
      <EconomicCalendarTab
        openEventId={openEventId}
        onOpenEventConsumed={handleOpenEventConsumed}
        monthOpen={monthOpen}
        onMonthOpenChange={setMonthOpen}
      />
    </NewsScreenShell>
  );
}
