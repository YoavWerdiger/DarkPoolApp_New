import React from 'react';
import EarningsReportsTab from './EarningsReportsTab';
import { NewsScreenShell } from './NewsScreenShell';

/** מסך מגירה — דיווחי רווח (בלי טאבים בתוך חדשות) */
export default function NewsEarningsScreen() {
  return (
    <NewsScreenShell title="דיווחי רווח">
      <EarningsReportsTab />
    </NewsScreenShell>
  );
}
