import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FEED_CARD_INNER_PAD,
  FEED_CARD_STACK_GAP,
  FEED_LIST_CHIPS_TO_CARDS,
  FEED_LIST_GUTTER,
  FEED_LIST_TITLE_TO_CHIPS,
  FEED_RHYTHM,
} from '../../screens/DarkPool/components/darkPoolFeedCardStyles';

const stylesSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/components/darkPoolFeedCardStyles.ts'),
  'utf8'
);
const feedCardSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/components/DarkPoolFeedCard.tsx'),
  'utf8'
);
const tradeCardSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/components/DarkPoolTradeFeedCard.tsx'),
  'utf8'
);
const homeSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/DarkPoolHomeScreen.tsx'),
  'utf8'
);

describe('feed card stack gap', () => {
  it('uses consumer card stack gap (APP_LAYOUT.cardStackGap)', () => {
    expect(FEED_CARD_STACK_GAP).toBe(16);
    expect(stylesSrc).toMatch(/export const FEED_CARD_STACK_GAP = 16/);
  });

  it('uses 20pt heroBody pad shared with trade-detail (UICard padding none)', () => {
    expect(FEED_CARD_INNER_PAD).toBe(20);
    expect(FEED_RHYTHM.cardPadH).toBe(20);
    expect(FEED_RHYTHM.cardPadV).toBe(20);
    expect(tradeCardSrc).toMatch(/<DarkPoolFeedCard/);
    expect(feedCardSrc).toMatch(/TRADE_HERO_UICARD\.padding/);
    expect(feedCardSrc).toMatch(/paddingVertical: FEED_RHYTHM\.cardPadV/);
    expect(feedCardSrc).toMatch(/paddingHorizontal: FEED_RHYTHM\.cardPadH/);
  });

  it('puts the gap on a wrapper outside overflow:hidden', () => {
    expect(feedCardSrc).toMatch(/feedCardStack/);
    expect(feedCardSrc).toMatch(/paddingBottom:\s*FEED_CARD_STACK_GAP/);
    expect(feedCardSrc).not.toMatch(/marginBottom:\s*FEED_CARD_STACK_GAP/);
    expect(feedCardSrc).not.toMatch(/paddingHorizontal:\s*FEED_CARD_INNER_PAD/);
    expect(tradeCardSrc).toMatch(/<DarkPoolFeedCard/);
  });

  it('keeps the 20pt list gutter', () => {
    expect(FEED_LIST_GUTTER).toBe(20);
    expect(homeSrc).toMatch(
      /paddingHorizontal:\s*tokens\.layout\?\.screenPadding\s*\?\?\s*FEED_LIST_GUTTER/
    );
  });

  it('spaces title → chips → cards on the home feed', () => {
    expect(FEED_LIST_TITLE_TO_CHIPS).toBe(12);
    expect(FEED_LIST_CHIPS_TO_CARDS).toBe(16);
    expect(homeSrc).toMatch(/FEED_LIST_TITLE_TO_CHIPS/);
    expect(homeSrc).toMatch(/FEED_LIST_CHIPS_TO_CARDS/);
    expect(FEED_RHYTHM.verbToNested).toBe(12);
    expect(FEED_RHYTHM.nameToDates).toBe(2);
  });
});
