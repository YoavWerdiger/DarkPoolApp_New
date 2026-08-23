import {
  matchEconomicFlagTier,
  resolveEconomicEventImportance,
} from '../../utils/economicEventImportance';

describe('economicEventImportance taxonomy', () => {
  test('red tier majors', () => {
    expect(matchEconomicFlagTier('CPI')).toBe('red');
    expect(matchEconomicFlagTier('Core CPI')).toBe('red');
    expect(matchEconomicFlagTier('PCE Price Index')).toBe('red');
    expect(matchEconomicFlagTier('Core PCE')).toBe('red');
    expect(matchEconomicFlagTier('PPI')).toBe('red');
    expect(matchEconomicFlagTier('Core PPI')).toBe('red');
    expect(matchEconomicFlagTier('Nonfarm Payrolls')).toBe('red');
    expect(matchEconomicFlagTier('NFP')).toBe('red');
    expect(matchEconomicFlagTier('Unemployment Rate')).toBe('red');
    expect(matchEconomicFlagTier('Average Hourly Earnings')).toBe('red');
    expect(matchEconomicFlagTier('FOMC Interest Rate Decision')).toBe('red');
    expect(matchEconomicFlagTier('FOMC Statement')).toBe('red');
    expect(matchEconomicFlagTier('FOMC Press Conference')).toBe('red');
    expect(matchEconomicFlagTier('FOMC Meeting Minutes')).toBe('red');
    expect(matchEconomicFlagTier('Fed Chair Powell Speaks')).toBe('red');
    expect(matchEconomicFlagTier('GDP')).toBe('red');
    expect(matchEconomicFlagTier('JOLTS Job Openings')).toBe('red');
    expect(matchEconomicFlagTier('ISM Manufacturing PMI')).toBe('red');
    expect(matchEconomicFlagTier('ISM Services PMI')).toBe('red');
    expect(matchEconomicFlagTier('Retail Sales')).toBe('red');
    expect(matchEconomicFlagTier('Core Retail Sales')).toBe('red');
    expect(matchEconomicFlagTier('CB Consumer Confidence')).toBe('red');
    expect(matchEconomicFlagTier('מדד המחירים לצרכן')).toBe('red');
    expect(matchEconomicFlagTier('Inflation Rate')).toBe('red');
    expect(matchEconomicFlagTier('Core Inflation Rate')).toBe('red');
    expect(matchEconomicFlagTier('📊 שיעור אינפלציה')).toBe('red');
    expect(matchEconomicFlagTier('אינפלציה')).toBe('red');
  });

  test('orange tier seconds', () => {
    expect(matchEconomicFlagTier('ADP Non-Farm Employment Change')).toBe('orange');
    expect(matchEconomicFlagTier('Initial Jobless Claims')).toBe('orange');
    expect(matchEconomicFlagTier('UoM Consumer Sentiment')).toBe('orange');
    expect(matchEconomicFlagTier('Michigan Consumer Sentiment')).toBe('orange');
    expect(matchEconomicFlagTier('UoM Inflation Expectations')).toBe('orange');
    expect(matchEconomicFlagTier('Michigan Inflation Expectations')).toBe('orange');
    expect(matchEconomicFlagTier('Consumer Inflation Expectations')).toBe('orange');
    expect(matchEconomicFlagTier('📊 ציפיות אינפלציה')).toBe('orange');
    expect(matchEconomicFlagTier('Durable Goods Orders')).toBe('orange');
    expect(matchEconomicFlagTier('FOMC Member Speaks')).toBe('orange');
    expect(matchEconomicFlagTier('Fed Waller Speaks')).toBe('orange');
  });

  test('powell stays red over generic fed speaks', () => {
    expect(matchEconomicFlagTier('Fed Chair Powell Speaks')).toBe('red');
    expect(resolveEconomicEventImportance('Fed Chair Powell Speaks', 'low')).toBe('high');
    expect(resolveEconomicEventImportance('Fed Waller Speaks', 'low')).toBe('medium');
  });

  test('excludes narrow CPI variants from red', () => {
    expect(matchEconomicFlagTier('CPI Energy')).toBeNull();
    expect(matchEconomicFlagTier('CPI Food')).toBeNull();
  });

  test('jolts quits and gdp price index are not red', () => {
    expect(matchEconomicFlagTier('JOLTs Job Quits')).toBeNull();
    expect(matchEconomicFlagTier('GDP Price Index')).toBeNull();
    expect(matchEconomicFlagTier('JOLTS Job Openings')).toBe('red');
    expect(matchEconomicFlagTier('GDP (QoQ)')).toBe('red');
  });

  test('ISM subcomponents are not red', () => {
    expect(matchEconomicFlagTier('ISM Manufacturing Employment')).toBeNull();
    expect(matchEconomicFlagTier('ISM Manufacturing Prices')).toBeNull();
    expect(matchEconomicFlagTier('ISM Services Prices')).toBeNull();
    expect(matchEconomicFlagTier('ISM Manufacturing PMI')).toBe('red');
    expect(matchEconomicFlagTier('ISM Services PMI')).toBe('red');
  });

  test('outside list keeps fallback', () => {
    expect(resolveEconomicEventImportance('Housing Starts', 'low')).toBe('low');
    expect(resolveEconomicEventImportance('Housing Starts', 'medium')).toBe('medium');
    expect(resolveEconomicEventImportance('Trade Balance', 'high')).toBe('high');
  });
});
