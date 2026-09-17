import {
  translateEconomicEventName,
  translateEconomicEventNameSmart,
} from '../../utils/economicEventTranslations';

describe('economic event title period suffixes', () => {
  it('keeps MoM/YoY meaning on CPI-like titles (change, not absolute index)', () => {
    expect(translateEconomicEventNameSmart('CPI (MoM)')).toBe('מדד המחירים לצרכן (חודשי)');
    expect(translateEconomicEventNameSmart('CPI (YoY)')).toBe('מדד המחירים לצרכן (שנתי)');
    expect(translateEconomicEventNameSmart('Core CPI (MoM)')).toBe(
      'מדד המחירים לצרכן (ללא מזון ואנרגיה) (חודשי)',
    );
    expect(translateEconomicEventName('PPI (YoY)')).toBe('מדד מחירי היצרנים (שנתי)');
  });

  it('preserves trailing qualifiers after the period token', () => {
    expect(translateEconomicEventNameSmart('Core PCE Prices (QoQ) - Prelim')).toContain('(רבעוני)');
  });

  it('leaves rate titles without inventing a percent suffix in the name', () => {
    expect(translateEconomicEventNameSmart('Unemployment Rate')).toBe('שיעור אבטלה');
  });
});
