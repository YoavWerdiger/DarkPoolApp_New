import i18n from '../../lib/i18n';
import React, { useCallback } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import EconomicCalendarTab from './EconomicCalendarTab';
import { NewsScreenShell } from './NewsScreenShell';

/** מסך מגירה — יומן כלכלי (בלי טאבים בתוך חדשות) */
export default function NewsEconomicCalendarScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  // מפוש (economic_result) — האירוע נפתח אחרי טעינה טרייה
  const openEventId = typeof route.params?.eventId === 'string' ? route.params.eventId : null;
  const handleOpenEventConsumed = useCallback(() => {
    (navigation as any).setParams?.({ eventId: undefined });
  }, [navigation]);

  return (
    <NewsScreenShell title={i18n.t('auto.screens__News__NewsEconomicCalendarScreen.s1')}>
      <EconomicCalendarTab openEventId={openEventId} onOpenEventConsumed={handleOpenEventConsumed} />
    </NewsScreenShell>
  );
}
