import { readFileSync } from 'fs';
import { join } from 'path';
import { withHebrew } from '../helpers/withHebrew';

const tabSrc = withHebrew(readFileSync(
  join(__dirname, '../../screens/Markets/tabs/MarketsHeatmapsTab.tsx'),
  'utf8'
));

const toggleStart = tabSrc.indexOf('function HeatmapTabToggle');
const toggleEnd = tabSrc.indexOf('export function MarketsHeatmapsTab');
const toggleSrc = tabSrc.slice(toggleStart, toggleEnd);

describe('heatmap tabs', () => {
  it('keeps S&P 500 first, then Nasdaq, then crypto', () => {
    expect(tabSrc).toMatch(
      /const HEATMAP_TABS[\s\S]*id:\s*'sp500'[\s\S]*id:\s*'nasdaq'[\s\S]*id:\s*'crypto'/
    );
    expect(tabSrc).toMatch(/label:\s*'S&P 500'/);
    expect(tabSrc).toMatch(/label:\s*'נאסד״ק'/);
    expect(tabSrc).toMatch(/label:\s*'קריפטו'/);
  });

  it('is flat and fully transparent — no glass, card, or green tint', () => {
    // הטאבים עברו לרכיב המשותף SegmentedTabs — לא סטייל מקומי
    expect(toggleSrc).toMatch(/<SegmentedTabs/);
    expect(toggleSrc).not.toMatch(/MarketsEmbedSwitcher/);
    expect(toggleSrc).not.toMatch(/MarketsSegmentedControl/);
    expect(toggleSrc).not.toMatch(/GlassChip/);
    expect(toggleSrc).not.toMatch(/UICard/);
    expect(toggleSrc).not.toMatch(/primary\.main/);
    // accessibilityRole="tab" נמצא בתוך SegmentedTabs
  });

  it('stays pinned above the heatmap — not inside a scroll header', () => {
    expect(tabSrc).not.toMatch(/ListHeaderComponent=\{/);
    expect(tabSrc.indexOf('<HeatmapTabToggle')).toBeLessThan(
      tabSrc.indexOf('<MarketsTradingView')
    );
  });

  it('leaves a small gap under the tabs before the heatmap', () => {
    expect(toggleSrc).toMatch(/paddingBottom:\s*tokens\.spacing\.md/);
  });

  it('uses the shared SegmentedTabs (active underline + RTL order live there)', () => {
    expect(toggleSrc).toMatch(/<SegmentedTabs/);
  });
});
