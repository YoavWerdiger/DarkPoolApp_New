import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FEED_AVATAR_SIZE,
  FEED_CARD_TYPE,
  FEED_OUTER_GLASS_INTENSITY,
  FEED_OUTER_UICARD,
  TRADE_HERO_UICARD,
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
const nestSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/components/DarkPoolNestedQuoteCard.tsx'),
  'utf8'
);

describe('FEED_CARD_TYPE', () => {
  it('keeps the compact feed / trade-body scale', () => {
    expect(FEED_CARD_TYPE.name).toEqual({
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '600',
      letterSpacing: -0.2,
    });
    expect(FEED_CARD_TYPE.action).toEqual({
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    });
    expect(FEED_CARD_TYPE.dates).toEqual({
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400',
    });
    expect(FEED_CARD_TYPE.nestedTicker.fontSize).toBe(13);
    expect(FEED_CARD_TYPE.nestedPrice.fontSize).toBe(16);
    expect(FEED_CARD_TYPE.nestedLabel.fontSize).toBe(13);
    expect(FEED_CARD_TYPE.nestedSince.fontSize).toBe(13);
  });

  it('trade hero action line uses cardSubtitle scale, not cardTitle', () => {
    expect(stylesSrc).toMatch(/action: \{[\s\S]*?fontSize: FEED_CARD_TYPE\.action\.fontSize/);
    expect(stylesSrc).toMatch(/actionMeta:[\s\S]*FEED_CARD_TYPE\.dates\.fontSize/);
    expect(FEED_CARD_TYPE.action.fontSize).toBe(13);
    expect(FEED_CARD_TYPE.name.fontSize).toBe(17);
  });

  it('keeps journal card-in-card nest padding, not a flattened hairline row', () => {
    expect(FEED_RHYTHM.nestedPadV).toBe(8);
    expect(FEED_RHYTHM.nestedPadH).toBe(8);
    expect(stylesSrc).not.toMatch(/borderTopWidth:\s*StyleSheet\.hairlineWidth/);
    expect(stylesSrc).toMatch(/FEED_NESTED_GLASS_INTENSITY/);
    expect(stylesSrc).toMatch(/כרטיס-בתוך-כרטיס/);
  });
});

describe('feed trade card chrome', () => {
  it('matches trade-detail identity + sentence + nested quote nest', () => {
    expect(FEED_AVATAR_SIZE).toBe(40);
    expect(FEED_OUTER_GLASS_INTENSITY).toBe('light');
    expect(TRADE_HERO_UICARD).toMatchObject({
      variant: 'soft',
      glassIntensity: 'light',
      padding: 'none',
      enableBlur: false,
      showGlassBorder: false,
    });
    expect(FEED_OUTER_UICARD).toBe(TRADE_HERO_UICARD);
    expect(stylesSrc).toMatch(/tradeHeroGlassFrameStyle/);
    expect(feedCardSrc).toMatch(/tradeHeroGlassFrameStyle/);
    expect(feedCardSrc).toMatch(/tradeHeroInnerCardStyle/);
    expect(feedCardSrc).toMatch(/TRADE_HERO_UICARD\.enableBlur/);
    expect(feedCardSrc).not.toMatch(/borderWidth: accent \? 1 : 0/);
    expect(feedCardSrc).not.toMatch(/paddingVertical:\s*FEED_CARD_INNER_PAD/);
    expect(tradeCardSrc).toMatch(/<DarkPoolFeedCard/);
    expect(tradeCardSrc).not.toMatch(/<UICard/);
    expect(tradeCardSrc).toMatch(/createTradeHeroCardStyles/);
    expect(tradeCardSrc).toMatch(/size=\{FEED_AVATAR_SIZE\}/);
    expect(tradeCardSrc).toMatch(/numberOfLines=\{2\}/);
    expect(tradeCardSrc).toMatch(/heroStyles\.personHint|styles\.personHint/);
    expect(tradeCardSrc).toMatch(/summary\.verb/);
    expect(tradeCardSrc).toMatch(/summary\.primaryRender/);
    expect(tradeCardSrc).toMatch(/summary\.metaRender/);
    expect(tradeCardSrc).toMatch(/buildCongressTradeDetailSummary/);
    expect(tradeCardSrc).toMatch(/buildInsiderTradeDetailSummary/);
    expect(tradeCardSrc).not.toMatch(/DarkPoolNestedQuoteCard/);
    expect(tradeCardSrc).not.toMatch(/מאז העסקה/);
    expect(tradeCardSrc).not.toMatch(/DarkPoolFeedNestedCard/);
    expect(tradeCardSrc).not.toMatch(/resolveFeedDatesLine/);
    expect(tradeCardSrc).not.toMatch(/נחשף/);
    expect(tradeCardSrc).not.toMatch(/בוצע/);
    expect(feedCardSrc.split('<UICard').length - 1).toBe(1);
    expect(stylesSrc).toMatch(/background\.cardSolid/);
    expect(nestSrc).toMatch(/<UICard[\s\S]*variant="soft"/);
    expect(nestSrc).toMatch(/disableBlur/);
    expect(nestSrc).toMatch(/background\.primary/);
    expect(nestSrc).toMatch(/FEED_NESTED_RADIUS/);
  });

  it('keeps logo, ticker, live price, מאז העסקה on shared nest component', () => {
    expect(nestSrc).toMatch(/TickerLogo/);
    expect(nestSrc).toMatch(/מחיר חי/);
    expect(nestSrc).toMatch(/מאז העסקה/);
    expect(nestSrc).toMatch(/toDataIsland\(tickerBare\)/);
    expect(tradeCardSrc).not.toMatch(/slots\.priceKnown/);
    expect(tradeCardSrc).not.toMatch(/משוער/);
    expect(tradeCardSrc).not.toMatch(/midpoint\s*\(/);
  });
});
