import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PROFILE_FOLLOW_DOCK_GAP,
  PROFILE_FOLLOW_PILL_HEIGHT,
  PROFILE_FOLLOW_PILL_RADIUS,
  profileFollowContentPad,
  profileFollowDockBottom,
  profileFollowOverlayHeight,
} from '../../screens/DarkPool/utils/profileFollowBar';
import {
  pickDefaultSnapshotChartPeriod,
  selectProfileSnapshotSeries,
  SNAPSHOT_CHART_PERIODS,
  type ChartPoint,
} from '../../screens/DarkPool/utils/profileChartSeries';

describe('profileFollowBar', () => {
  it('pins the dock above the home indicator only on a stack profile', () => {
    expect(profileFollowDockBottom({ safeBottom: 34 })).toBe(34);
    expect(profileFollowDockBottom({ safeBottom: 0 })).toBe(10);
  });

  it('adds tab-bar height when the profile sits inside tabs', () => {
    expect(profileFollowDockBottom({ safeBottom: 34, tabBarHeight: 58 })).toBe(92);
  });

  it('reserves scroll padding so last rows clear the sticky pill', () => {
    const pad = profileFollowContentPad({ safeBottom: 34 });
    const overlay = profileFollowOverlayHeight({ safeBottom: 34 });
    expect(pad).toBe(overlay + PROFILE_FOLLOW_DOCK_GAP + 16);
    expect(pad).toBeGreaterThan(PROFILE_FOLLOW_PILL_HEIGHT + 34);
  });

  it('keeps follow dock in layout flow (not absolute over scroll content)', () => {
    const src = readFileSync(
      join(__dirname, '../../screens/DarkPool/PersonPortfolioProfileScreen.tsx'),
      'utf8',
    );
    expect(src).toMatch(/Animated\.ScrollView[\s\S]*style=\{\[styles\.flex/);
    expect(src).not.toMatch(/followDock:\s*\{[\s\S]*?position:\s*'absolute'/);
    expect(src).toMatch(/followDock:\s*\{[\s\S]*?paddingTop:\s*PROFILE_FOLLOW_DOCK_GAP/);
  });

  it('follow dock uses opaque navChrome face (not transparent UICard shell)', () => {
    const src = readFileSync(
      join(__dirname, '../../screens/DarkPool/PersonPortfolioProfileScreen.tsx'),
      'utf8',
    );
    expect(src).toMatch(
      /const followDock =[\s\S]*chromeSurfaceCardStyle\(tokens,/,
    );
    expect(src).not.toMatch(/const followDock =[\s\S]*CHROME_UICARD/);
    expect(PROFILE_FOLLOW_PILL_RADIUS).toBe(PROFILE_FOLLOW_PILL_HEIGHT / 2);
    expect(src).toContain('PROFILE_FOLLOW_PILL_RADIUS');
  });
});

describe('selectProfileSnapshotSeries', () => {
  const mtm: ChartPoint[] = [
    { date: '2025-01-02', value: 100 },
    { date: '2025-06-02', value: 120 },
  ];

  it('uses Quiver CurrentHolding × Yahoo closes for congress', () => {
    expect(
      selectProfileSnapshotSeries({
        kind: 'politician',
        holdingsEngine: 'congress',
        congressMtm: mtm,
        form4Mtm: [],
        fundSeries: [],
      })
    ).toEqual(mtm);
  });

  it('uses Form 4 running shares × close when that series exists', () => {
    expect(
      selectProfileSnapshotSeries({
        kind: 'insider',
        holdingsEngine: 'form4',
        congressMtm: [],
        form4Mtm: mtm,
        fundSeries: [],
      })
    ).toEqual(mtm);
  });

  it('uses Trump notional × Yahoo close ratio when that series exists', () => {
    expect(
      selectProfileSnapshotSeries({
        kind: 'politician',
        holdingsEngine: 'trump',
        congressMtm: [],
        form4Mtm: [],
        trumpMtm: mtm,
        fundSeries: [],
      })
    ).toEqual(mtm);
    expect(
      selectProfileSnapshotSeries({
        kind: 'politician',
        holdingsEngine: 'trump',
        congressMtm: mtm,
        form4Mtm: [],
        trumpMtm: [],
        fundSeries: [],
      })
    ).toEqual([]);
  });

  it('hides the chart for trades_only / empty holdings', () => {
    expect(
      selectProfileSnapshotSeries({
        kind: 'politician',
        holdingsEngine: null,
        congressMtm: mtm,
        form4Mtm: [],
        fundSeries: [],
      })
    ).toEqual([]);
    expect(
      selectProfileSnapshotSeries({
        kind: 'insider',
        holdingsEngine: null,
        congressMtm: [],
        form4Mtm: [],
        fundSeries: mtm,
      })
    ).toEqual([]);
  });

  it('exposes snapshot chart period chips (incl. 3M / All)', () => {
    expect(SNAPSHOT_CHART_PERIODS).toEqual([
      '1D',
      '1W',
      '1M',
      '3M',
      'YTD',
      '1Y',
      '5Y',
      'All',
    ]);
    const year: ChartPoint[] = [
      { date: '2025-01-02', value: 100 },
      { date: '2025-12-20', value: 140 },
    ];
    expect(pickDefaultSnapshotChartPeriod(year)).toBe('1Y');
  });

  it('uses the 13F daily series for fund managers', () => {
    expect(
      selectProfileSnapshotSeries({
        kind: 'fund_manager',
        holdingsEngine: 'filing',
        congressMtm: [],
        form4Mtm: [],
        fundSeries: mtm,
      })
    ).toEqual(mtm);
  });
});
