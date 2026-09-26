import {
  PORTFOLIO_NEGATIVE_AMOUNT_COLOR,
  portfolioAmountDisplayColor,
  resolvePortfolioChartHeaderValue,
} from '../../screens/Portfolios/utils/chartDisplay';

describe('resolvePortfolioChartHeaderValue', () => {
  it('uses series last when plotted count is 1 (ranges placeholder is 0)', () => {
    expect(
      resolvePortfolioChartHeaderValue({
        plottedCount: 1,
        rangesLast: 0,
        seriesLast: 42_500.75,
      }),
    ).toBe(42_500.75);
  });

  it('uses ranges when two or more plotted points', () => {
    expect(
      resolvePortfolioChartHeaderValue({
        plottedCount: 2,
        rangesLast: 50_000,
        seriesLast: 48_000,
      }),
    ).toBe(50_000);
  });

  it('colors negative amounts Red 400', () => {
    expect(PORTFOLIO_NEGATIVE_AMOUNT_COLOR).toBe('#F87171');
    expect(portfolioAmountDisplayColor(-1200, '#FFF')).toBe('#F87171');
    expect(portfolioAmountDisplayColor(500, '#FFF')).toBe('#FFF');
    expect(portfolioAmountDisplayColor(0, '#FFF')).toBe('#FFF');
  });

  it('prefers active scrub value', () => {
    expect(
      resolvePortfolioChartHeaderValue({
        activeValue: 12_345,
        plottedCount: 2,
        rangesLast: 50_000,
        seriesLast: 48_000,
      }),
    ).toBe(12_345);
  });
});
