import {
  ECONOMIC_EVENT_SKELETON_LAYOUT,
  EARNINGS_REPORT_SKELETON_LAYOUT,
} from '../../components/ui/SkeletonLoader';

describe('news calendar skeletons — LTR Yoga row, not flipped', () => {
  it('earnings card: logo/ticker first (physical left), revenue then EPS, accent left', () => {
    expect(EARNINGS_REPORT_SKELETON_LAYOUT.rowDirection).toBe('row');
    expect(EARNINGS_REPORT_SKELETON_LAYOUT.accentBar).toBe('left');
    expect(EARNINGS_REPORT_SKELETON_LAYOUT.logoOnStart).toBe(true);
    expect(EARNINGS_REPORT_SKELETON_LAYOUT.revenueBeforeEps).toBe(true);
  });

  it('economic event: title then time badge, metrics in row, accent right', () => {
    expect(ECONOMIC_EVENT_SKELETON_LAYOUT.rowDirection).toBe('row');
    expect(ECONOMIC_EVENT_SKELETON_LAYOUT.accentBar).toBe('right');
    expect(ECONOMIC_EVENT_SKELETON_LAYOUT.titleBeforeTimeBadge).toBe(true);
    expect(ECONOMIC_EVENT_SKELETON_LAYOUT.metricsRowDirection).toBe('row');
  });
});
