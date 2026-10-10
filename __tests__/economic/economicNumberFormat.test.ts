import {
  formatEconomicDisplayValue,
  parseEconomicNumber,
  shouldShowEconomicPercent,
  stripEconomicPercentSuffix,
} from '../../utils/economicNumberFormat';

describe('shouldShowEconomicPercent', () => {
  it('shows % for rates / unemployment / interest / expectations / GDP growth', () => {
    expect(shouldShowEconomicPercent('Unemployment Rate')).toBe(true);
    expect(shouldShowEconomicPercent('Fed Interest Rate Decision')).toBe(true);
    expect(shouldShowEconomicPercent('Federal Funds Rate')).toBe(true);
    expect(shouldShowEconomicPercent('Michigan Inflation Expectations')).toBe(true);
    expect(shouldShowEconomicPercent('Average Hourly Earnings (MoM)')).toBe(true);
    expect(shouldShowEconomicPercent('GDP Growth Rate QoQ')).toBe(true);
    expect(shouldShowEconomicPercent('שיעור אבטלה')).toBe(true);
  });

  it('hides % for CPI family and levels/counts', () => {
    expect(shouldShowEconomicPercent('CPI (MoM)')).toBe(true);
    expect(shouldShowEconomicPercent('CPI (YoY)')).toBe(true);
    expect(shouldShowEconomicPercent('Core CPI')).toBe(false);
    expect(shouldShowEconomicPercent('Core PCE Price Index (MoM)')).toBe(true);
    expect(shouldShowEconomicPercent('PPI (YoY)')).toBe(true);
    expect(shouldShowEconomicPercent('Nonfarm Payrolls')).toBe(false);
    expect(shouldShowEconomicPercent('Initial Jobless Claims')).toBe(false);
    expect(shouldShowEconomicPercent('ISM Manufacturing PMI')).toBe(false);
    expect(shouldShowEconomicPercent('Consumer Confidence')).toBe(false);
    expect(shouldShowEconomicPercent('Retail Sales')).toBe(false);
    // דוחות שינוי — אחוזים
    expect(shouldShowEconomicPercent('Retail Sales (MoM)')).toBe(true);
    expect(shouldShowEconomicPercent('Pending Home Sales (MoM)')).toBe(true);
    expect(shouldShowEconomicPercent('Michigan Consumer Sentiment - Prelim')).toBe(false);
    expect(shouldShowEconomicPercent('Philadelphia Fed Manufacturing Survey')).toBe(false);
  });
});

describe('formatEconomicDisplayValue — selective %', () => {
  it('CPI-style: decimal without %', () => {
    expect(formatEconomicDisplayValue('0.4%', 'CPI (MoM)')).toBe('0.4%');
    expect(formatEconomicDisplayValue('3.2', 'CPI (YoY)')).toBe('3.2%');
    expect(formatEconomicDisplayValue('0.3%', 'Core PCE (MoM)')).toBe('0.3%');
  });

  it('rate-style: decimal with %', () => {
    expect(formatEconomicDisplayValue('4.1', 'Unemployment Rate')).toBe('4.1%');
    expect(formatEconomicDisplayValue('4.1%', 'Unemployment Rate')).toBe('4.1%');
    expect(formatEconomicDisplayValue('5.25', 'Fed Interest Rate Decision')).toBe('5.25%');
    expect(formatEconomicDisplayValue('3.0', 'Michigan Inflation Expectations')).toBe('3%');
  });

  it('keeps magnitude suffixes and strips stray % when not a rate', () => {
    expect(formatEconomicDisplayValue('250K', 'Nonfarm Payrolls')).toBe('250K');
    expect(formatEconomicDisplayValue('1.5M', 'Retail Sales')).toBe('1.5M');
    expect(stripEconomicPercentSuffix('%')).toBe('');
  });

  it('parseEconomicNumber ignores %', () => {
    expect(parseEconomicNumber('3.2%')).toBe(3.2);
    expect(parseEconomicNumber('0.4')).toBe(0.4);
  });
});
