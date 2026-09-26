import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DAY_DIVIDER_CARD,
  DAY_DIVIDER_PILL_FONT_SIZE,
  DAY_DIVIDER_PILL_MIN_HEIGHT,
  DAY_DIVIDER_PILL_PAD_H,
  DAY_DIVIDER_PILL_PAD_V,
  DAY_DIVIDER_SELECTED_INTENSITY,
} from '../../components/ui/DayDividerPill';

const pillSrc = readFileSync(
  join(__dirname, '../../components/ui/DayDividerPill.tsx'),
  'utf8'
);
const dividerSrc = readFileSync(
  join(__dirname, '../../components/chat/DayDivider.tsx'),
  'utf8'
);
const tickerSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/DarkPoolTickerScreen.tsx'),
  'utf8'
);
const chartSrc = readFileSync(
  join(__dirname, '../../screens/Portfolios/components/PortfolioValueChart.tsx'),
  'utf8'
);
const homeSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/DarkPoolHomeScreen.tsx'),
  'utf8'
);
const exploreFilterSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/components/ExploreKindFilter.tsx'),
  'utf8'
);
const tradesListSrc = readFileSync(
  join(__dirname, '../../screens/Journal/TradesListTab.tsx'),
  'utf8'
);
const addTradeSrc = readFileSync(
  join(__dirname, '../../screens/Journal/AddTradeScreen.tsx'),
  'utf8'
);
const journalDataSrc = readFileSync(
  join(__dirname, '../../screens/Journal/JournalDataTab.tsx'),
  'utf8'
);
const tradingSrc = readFileSync(
  join(__dirname, '../../screens/Journal/TradingScreen.tsx'),
  'utf8'
);

describe('DayDividerPill', () => {
  it('is the chat day-divider NavGlass pill', () => {
    expect(DAY_DIVIDER_CARD.glassIntensity).toBe('light');
    expect(DAY_DIVIDER_CARD.enableBlur).toBe(true);
    expect(DAY_DIVIDER_SELECTED_INTENSITY).toBe('medium');
    expect(DAY_DIVIDER_PILL_PAD_H).toBe(12);
    expect(DAY_DIVIDER_PILL_PAD_V).toBe(5);
    expect(DAY_DIVIDER_PILL_MIN_HEIGHT).toBe(30);
    expect(DAY_DIVIDER_PILL_FONT_SIZE).toBe(11);
    expect(pillSrc).toMatch(/tokens\.borderRadius\.lg/);
    expect(pillSrc).toMatch(/paddingHorizontal: DAY_DIVIDER_PILL_PAD_H/);
    expect(pillSrc).toMatch(/paddingVertical: DAY_DIVIDER_PILL_PAD_V/);
    expect(pillSrc).toMatch(/fontSize: DAY_DIVIDER_PILL_FONT_SIZE/);
    expect(pillSrc).toMatch(/fontWeight: tokens\.typography\.fontWeight\.medium/);
    expect(pillSrc).toMatch(/chromeSurfaceFill/);
    expect(pillSrc).not.toMatch(/NavGlassSurface/);
    expect(pillSrc).toMatch(/styles\.frame/);
    expect(dividerSrc).toMatch(/DayDividerPill/);
  });

  it('wires ticker, portfolio, feed, explore, and journal chips to DayDividerPill', () => {
    expect(tickerSrc).toMatch(/DayDividerPill/);
    expect(tickerSrc).not.toMatch(/GlassChip/);
    expect(chartSrc).toMatch(/DayDividerPill/);
    expect(chartSrc).not.toMatch(/periodBtn/);
    expect(homeSrc).toMatch(/DayDividerPill/);
    expect(homeSrc).not.toMatch(/GlassChip/);
    const homeChips = homeSrc.slice(
      homeSrc.indexOf('FEED_RECENT_KIND_CHIPS.map'),
      homeSrc.indexOf('FEED_RECENT_KIND_CHIPS.map') + 500
    );
    const tickerChips = tickerSrc.slice(
      tickerSrc.indexOf('visibleRanges.map'),
      tickerSrc.indexOf('visibleRanges.map') + 500
    );
    const chartChips = chartSrc.slice(
      chartSrc.indexOf('DayDividerPill'),
      chartSrc.indexOf('DayDividerPill') + 500
    );
    expect(homeChips).not.toMatch(/glassIntensity=/);
    expect(homeChips).not.toMatch(/disableBlur/);
    expect(tickerChips).not.toMatch(/glassIntensity=/);
    expect(tickerChips).not.toMatch(/disableBlur/);
    expect(chartChips).not.toMatch(/glassIntensity=/);
    expect(chartChips).not.toMatch(/disableBlur/);
    expect(exploreFilterSrc).toMatch(/DayDividerPill/);
    expect(exploreFilterSrc).not.toMatch(/GlassChip/);
    expect(tradesListSrc).toMatch(/DayDividerPill/);
    expect(tradesListSrc).not.toMatch(/GlassChip/);
    expect(addTradeSrc).toMatch(/DayDividerPill/);
    expect(addTradeSrc).not.toMatch(/GlassChip/);
    expect(journalDataSrc).toMatch(/DayDividerPill/);
    expect(journalDataSrc).not.toMatch(/GlassChip/);
    expect(tradingSrc).toMatch(/DayDividerPill/);
    expect(tradingSrc).not.toMatch(/GlassChip/);
  });
});
