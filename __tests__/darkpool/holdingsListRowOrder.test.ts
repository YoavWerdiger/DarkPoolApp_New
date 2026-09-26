import { readFileSync } from 'fs';
import { join } from 'path';

const rowSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/components/HoldingsPieSection.tsx'),
  'utf8'
);

const profileSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/PersonPortfolioProfileScreen.tsx'),
  'utf8'
);

/**
 * RTL visual contract:
 *   [logo] TICKER              $VALUE
 *          12%                 +8.2%
 * ticker/weight | value/return — never inverted vertically.
 */
describe('HoldingsPieSection legend layout', () => {
  const pieFn = rowSrc.slice(
    rowSrc.indexOf('export function HoldingsPieSection'),
    rowSrc.indexOf('export function HoldingsListRow')
  );
  const pieStyles = rowSrc.slice(
    rowSrc.indexOf('function createStyles(tokens'),
    rowSrc.indexOf('function createRowStyles(tokens')
  );

  it('does not clip the bottom legend row against the glass card border', () => {
    expect(pieFn).toMatch(/contentContainerStyle=\{styles\.cardContent\}/);
    expect(pieStyles).toMatch(/cardContent:\s*\{[\s\S]*?overflow:\s*'visible'/);
    expect(pieStyles).not.toMatch(/card:\s*\{[\s\S]*?overflow:\s*'hidden'/);
    expect(pieStyles).toMatch(/donutWrap:[\s\S]*?alignItems:\s*'flex-start'/);
    expect(pieStyles).toMatch(/legend:[\s\S]*?paddingBottom:\s*2/);
    expect(pieStyles).toMatch(
      /legendLabel:[\s\S]*?lineHeight:\s*DARK_POOL_TYPE\.caption\.lineHeight/
    );
  });
});

describe('HoldingsListRow visual order', () => {
  const fn = rowSrc.slice(
    rowSrc.indexOf('export function HoldingsListRow'),
    rowSrc.indexOf('export function HoldingTickerDot')
  );

  it('keeps ticker above allocation and value above return', () => {
    const ticker = fn.indexOf('style={styles.ticker}');
    const allocation = fn.indexOf('style={styles.allocation}');
    const value = fn.indexOf('style={styles.holdingValue}');
    const ret = fn.indexOf('styles.holdingReturn');

    expect(ticker).toBeGreaterThan(-1);
    expect(allocation).toBeGreaterThan(ticker);
    expect(value).toBeGreaterThan(allocation);
    expect(ret).toBeGreaterThan(value);
    expect(fn).not.toMatch(/column-reverse/);
  });

  it('routes Trump through the notional engine, not bioguide congress', () => {
    expect(profileSrc).toMatch(/isTrumpPerson/);
    expect(profileSrc).toMatch(/holdingsEngine === 'trump'/);
    expect(profileSrc).toMatch(/buildTrumpMarkToMarketSeries/);
    expect(profileSrc).toMatch(/listCongressTradesForPerson/);
  });

  it('builds whale charts from historical 13F × daily closes, not quarterly AUM dots only', () => {
    expect(profileSrc).toMatch(/build13FMarkToMarketSeries/);
    expect(profileSrc).toMatch(/fetchFundHoldingsHistory/);
    expect(profileSrc).toMatch(/fetch13FDailyCloses/);
    expect(profileSrc).toMatch(/if \(fundMtmSeries.length >= 2\) return fundMtmSeries/);
    expect(profileSrc).toMatch(/latestBookRowsFromHoldings/);
    expect(profileSrc).not.toMatch(/return fullChartSeries/);
  });

  it('fills Form 4 / 13F row return from avg cost vs live close, not a STOCK Act midpoint', () => {
    expect(profileSrc).toMatch(/form4LiveHoldings/);
    expect(profileSrc).toMatch(/quotesMapFromDailyCloses/);
    expect(profileSrc).toMatch(/replay13FAvgCost/);
    expect(profileSrc).toMatch(/impliedFilingPriceFrom13f/);
    expect(profileSrc).toMatch(/resolveCongressHoldingDisplayReturnPct/);
    expect(profileSrc).toMatch(/filingHoldingReturnPct/);
    expect(profileSrc).not.toMatch(/congressHoldingReturnPct\(/);
    expect(profileSrc).not.toMatch(/midpoint\(amount_label\)/);
  });

  it('stacks label / AUM / $change • % under one right-aligned column', () => {
    expect(profileSrc).toMatch(
      /valueBlock: \{[\s\S]*?direction: 'ltr'[\s\S]*?alignItems: 'flex-end'/
    );
    const labelStyle = profileSrc.slice(
      profileSrc.indexOf('valueLabel: {'),
      profileSrc.indexOf('valueHelpBtn:')
    );
    expect(labelStyle).toMatch(/darkPoolTextRtl/);
    expect(labelStyle).not.toMatch(/darkPoolPhysicalRightText/);
    expect(profileSrc).toMatch(/deltaRow: \{[\s\S]*?alignSelf: 'flex-end'/);
    expect(profileSrc).toMatch(
      /deltaRow: \{[\s\S]*?marginTop: APP_LAYOUT\.titleSubtitleGap/
    );
    const label = profileSrc.indexOf('styles.valueLabel');
    const aum = profileSrc.indexOf('styles.heroValue');
    const delta = profileSrc.indexOf('<SignedChangePair');
    expect(label).toBeGreaterThan(-1);
    expect(aum).toBeGreaterThan(label);
    expect(delta).toBeGreaterThan(aum);
  });

  it('is the profile holdings row', () => {
    expect(profileSrc).toMatch(/<HoldingsListRow[\s\S]*allocationLabel=/);
    expect(profileSrc).toMatch(/<HoldingsListRow[\s\S]*valueLabel=/);
    expect(profileSrc).toMatch(/<HoldingsListRow[\s\S]*returnLabel=/);
  });

  it('does not paint a ticker-partial cache as שווי תיק unless the bioguide fetch failed', () => {
    expect(profileSrc).toMatch(/listCongressHoldingsByBioguide/);
    expect(profileSrc).toMatch(/quiverHoldingsQuery\.isError/);
    expect(profileSrc).toMatch(/allowProfileFallback/);
    expect(profileSrc).not.toMatch(/fromCache\.length === 0 && p\?\.holdings_source === 'quiver_estimate'/);
  });

  it('uses a multi-ticker unstamped book instead of waiting on a live stamp', () => {
    const cacheSrc = readFileSync(
      join(__dirname, '../../services/darkpool/darkPoolDbCacheService.ts'),
      'utf8'
    );
    expect(cacheSrc).toMatch(/looksLikeCompleteBioguideHoldings/);
    expect(cacheSrc).toMatch(/isBioguideHoldingsCacheFresh\(payload, bg\) \|\|/);
  });

  it('sums every CurrentHolding row before slicing the profile list', () => {
    const edgeSrc = readFileSync(
      join(__dirname, '../../supabase/functions/uw-investor-profile/index.ts'),
      'utf8'
    );
    expect(edgeSrc).toMatch(
      /const quiverTotal = quiverHoldingRows\.reduce/
    );
    expect(edgeSrc).not.toMatch(
      /holdings = quiverHoldingRows\.slice\(0, 24\);\s*holdings_source = 'quiver_estimate';\s*const quiverTotal = holdings\.reduce/
    );
  });
});
