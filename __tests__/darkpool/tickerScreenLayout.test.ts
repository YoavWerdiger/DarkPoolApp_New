import { readFileSync } from 'fs';
import { join } from 'path';

const screenSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/DarkPoolTickerScreen.tsx'),
  'utf8'
);
const cacheSrc = readFileSync(
  join(__dirname, '../../services/darkpool/darkPoolDbCacheService.ts'),
  'utf8'
);
const syncSrc = readFileSync(
  join(__dirname, '../../supabase/functions/sync-quiver-congress-cache/index.ts'),
  'utf8'
);
const insiderCardSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/components/InsiderTradeCard.tsx'),
  'utf8'
);
const congressCardSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/components/CongressTradeCard.tsx'),
  'utf8'
);
const feedCardSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/components/DarkPoolTradeFeedCard.tsx'),
  'utf8'
);

describe('DarkPoolTickerScreen topology', () => {
  it('mirrors InsiderWave: header identity, price + market cap, chart, Holders|Feed', () => {
    expect(screenSrc).toMatch(/identityTicker/);
    expect(screenSrc).toMatch(/styles\.companyName/);
    expect(screenSrc).toMatch(/identityRow/);
    expect(screenSrc).toMatch(/priceRow/);
    expect(screenSrc).toMatch(/formatTickerMarketCap/);
    expect(screenSrc).toMatch(/tickerMarketCapLabel/);
    expect(screenSrc).toMatch(/PortfolioValueChart/);
    expect(screenSrc).toMatch(/DayDividerPill/);
    expect(screenSrc).not.toMatch(/GlassChip/);
    expect(screenSrc).toMatch(/tickerScreenHoldersTabLabel/);
    expect(screenSrc).toMatch(/tickerScreenFeedTabLabel/);
    expect(screenSrc).toMatch(/listCongressHoldingsByTicker/);
    expect(screenSrc).toMatch(/listCongressTradesByTicker/);
    expect(screenSrc).toMatch(/getTickerInsiderBuys/);
    expect(screenSrc).toMatch(/CongressTradeCard/);
    expect(screenSrc).toMatch(/InsiderTradeCard/);
    expect(screenSrc).not.toMatch(/listCongressTradesFromDb/);
    expect(screenSrc).not.toMatch(/toggleWatch|isWatching|star-outline/);
  });

  it('keeps logo + ticker + name on one header row, company name physical left', () => {
    expect(screenSrc).toMatch(/topBar: \{[\s\S]*?identityRow/);
    expect(screenSrc).toMatch(/identityRow: \{[\s\S]*?direction: 'ltr'/);
    expect(screenSrc).toMatch(/identityTicker: \{[\s\S]*?textAlign: 'left'/);
    expect(screenSrc).toMatch(/companyName: \{[\s\S]*?darkPoolPhysicalLeftText/);
    expect(screenSrc).not.toMatch(/headerTicker/);
  });

  it('renders each holder with the same UICard glass chrome as feed/journal', () => {
    expect(screenSrc).toMatch(/import UICard from '..\/..\/components\/ui\/UICard'/);
    expect(screenSrc).toMatch(
      /holders\.map\([\s\S]*?<UICard[\s\S]*?variant="soft"[\s\S]*?glassIntensity="light"[\s\S]*?padding="none"[\s\S]*?disableBlur[\s\S]*?InvestorPortrait/
    );
    expect(screenSrc).not.toMatch(/showGlassBorder=\{false\}/);
    expect(screenSrc).not.toMatch(/holders\.map\([\s\S]*?enableBlur/);
    expect(screenSrc).not.toMatch(/holders\.map\([\s\S]*?padding="sm"/);
    expect(screenSrc).toMatch(/holdersSection: \{[\s\S]*?gap:\s*8/);
    expect(screenSrc).toMatch(/holderPad: \{[\s\S]*?paddingVertical:\s*12[\s\S]*?paddingHorizontal:\s*14/);
    expect(screenSrc).toMatch(
      /holderCard: \{[\s\S]*?borderRadius:\s*tokens\.borderRadius\.xl[\s\S]*?borderWidth:\s*0[\s\S]*?overflow:\s*'hidden'[\s\S]*?backgroundColor:\s*'transparent'[\s\S]*?tokens\.shadows\.none/
    );
    expect(screenSrc).toMatch(/openHolder/);
    expect(screenSrc).toMatch(/DarkPoolInvestor/);
    expect(screenSrc).toMatch(/tickerHolderRowCopy\(holder, livePrice\)/);
    expect(screenSrc).toMatch(/holderMetricCol/);
    expect(screenSrc).toMatch(/holderShares/);
    expect(screenSrc).toMatch(/row\.sharesLabel/);
    expect(screenSrc).not.toMatch(/TickerInsiderBuyRow/);
    expect(screenSrc).not.toMatch(/היסטוריית Form 4/);
    expect(screenSrc).not.toMatch(/הדפסות אחרונות/);
    expect(screenSrc).not.toMatch(/פעילות אחרונה/);
  });

  it('does not invent STOCK Act shares or stamp משוער', () => {
    expect(screenSrc).not.toMatch(/משוער/);
    expect(screenSrc).not.toMatch(/midpoint/);
    expect(screenSrc).not.toMatch(/amount_label/);
    expect(screenSrc).not.toMatch(/amount_label.*\/|midpoint\(amount/);
    expect(screenSrc).toMatch(/tickerHolderRowCopy\(holder, livePrice\)/);
  });

  it('Feed Form 4 rows pass exact shares; congress keeps the disclosed range', () => {
    expect(insiderCardSrc).toMatch(/shares=\{shares\}/);
    expect(insiderCardSrc).toMatch(/price=\{trade\.price\}/);
    expect(insiderCardSrc).not.toMatch(/משוער|midpoint/);
    expect(congressCardSrc).toMatch(/formatDisclosedAmountRange/);
    expect(congressCardSrc).not.toMatch(/shares=\{/);
    expect(congressCardSrc).not.toMatch(/משוער|midpoint/);
    expect(feedCardSrc).toMatch(/buildInsiderTradeDetailSummary/);
    expect(feedCardSrc).toMatch(/buildCongressTradeDetailSummary/);
    expect(feedCardSrc).not.toMatch(/משוער/);
  });

  it('changes vs a real quote / range baseline', () => {
    expect(screenSrc).toMatch(/previousClose/);
    expect(screenSrc).toMatch(/tickerDisplayedChange/);
    expect(screenSrc).toMatch(/quoteQuery\.data\?\.market_cap/);
    expect(screenSrc).toMatch(/onScrubPoint=\{setScrubPoint\}/);
    expect(screenSrc).toMatch(/displayPrice = scrubPoint\?\.value \?\? livePrice/);
    expect(screenSrc).toMatch(/formatTickerLivePrice\(displayPrice\)/);
    expect(screenSrc).not.toMatch(/TickerRollingNumber/);
    expect(screenSrc).not.toMatch(/TICKER_ROLL_|stepRollingValue|durationMs/);
    expect(screenSrc).toMatch(/heroBlock/);
    expect(screenSrc).toMatch(/identityTicker: \{[\s\S]*?sectionTitle/);
    expect(screenSrc).toMatch(/livePrice: \{[\s\S]*?fontSize:\s*44/);
    expect(screenSrc).toMatch(
      /marketCapValue: \{[\s\S]*?DARK_POOL_TYPE\.sectionTitle\.fontSize[\s\S]*?DARK_POOL_TYPE\.sectionTitle\.lineHeight[\s\S]*?DARK_POOL_TYPE\.sectionTitle\.fontWeight/
    );
    expect(screenSrc).toMatch(
      /marketCapLabel: \{[\s\S]*?DARK_POOL_TYPE\.caption\.fontSize[\s\S]*?DARK_POOL_TYPE\.caption\.fontWeight/
    );
    expect(screenSrc).not.toMatch(/marketCapValue: \{[\s\S]*?fontSize:\s*17/);
    expect(screenSrc).toMatch(/SignedChangePair/);
    expect(screenSrc).toMatch(/absText=\{formatTickerAbsChange/);
    expect(screenSrc).toMatch(/pctText=\{formatTickerPctChange/);
    expect(screenSrc).not.toMatch(/▲|▼/);
    expect(screenSrc).not.toMatch(/entryReturn|reconstructed|entryPrice/);
  });

  it('fetches the selected chip range — not Yahoo max or a single 10y dump on 1D', () => {
    expect(screenSrc).toMatch(/yahooRequestForTickerRange\(range\)/);
    expect(screenSrc).toMatch(/yahooFallbackDailyFor1D/);
    expect(screenSrc).toMatch(/yahooRequestForTickerRange\('1D'\)/);
    expect(screenSrc).toMatch(/intraday/);
    expect(screenSrc).not.toMatch(/yahooRequestForTickerRange\('ALL'\)/);
    expect(screenSrc).not.toMatch(/getHistoricalPrices\(ticker, 'max'\)/);
  });

  it('asks the existing Quiver holdings cache for this ticker, not trades', () => {
    expect(cacheSrc).toMatch(/triggerQuiverHoldingsTickerSync/);
    expect(cacheSrc).toMatch(/triggerQuiverHoldingsBioguideSync/);
    expect(cacheSrc).toMatch(/sync-quiver-congress-cache/);
    expect(cacheSrc).toMatch(/tickers_synced/);
    expect(cacheSrc).toMatch(/bioguides_synced/);
    expect(cacheSrc).toMatch(/isTickerHoldingsCacheFresh/);
    expect(cacheSrc).toMatch(/isBioguideHoldingsCacheFresh/);
    expect(cacheSrc).toMatch(/listCongressTradesByTicker/);
    expect(cacheSrc).not.toMatch(/\.catch\(\(\) => undefined\)/);
    expect(cacheSrc).not.toMatch(/midpoint\(amount_label\)/);
    expect(syncSrc).toMatch(/fetchQuiverCongressStockHoldings\(key, \{ ticker \}\)/);
    expect(syncSrc).toMatch(/fetchQuiverCongressStockHoldings\(key, \{ bioguideId: bg \}\)/);
    expect(syncSrc).toMatch(/mergeTickerHoldingsIntoByBioguide/);
    expect(syncSrc).toMatch(/bioguidesSynced\[bg\]/);
  });
});
