import React from 'react';
import EconomicCalendarTab from './EconomicCalendarTab';
import { NewsScreenShell } from './NewsScreenShell';

/** מסך מגירה — יומן כלכלי (בלי טאבים בתוך חדשות) */
export default function NewsEconomicCalendarScreen() {
  return (
    <NewsScreenShell title="יומן כלכלי">
      <EconomicCalendarTab />
    </NewsScreenShell>
  );
}
