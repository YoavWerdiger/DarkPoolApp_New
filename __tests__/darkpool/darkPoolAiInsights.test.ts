import {
  buildTemplateInsight,
  generateAiInsight,
} from '../../services/darkpool/darkPoolAiInsights';

describe('buildTemplateInsight', () => {
  it('handles WHALE in Hebrew with the formatted premium', () => {
    const text = buildTemplateInsight({
      ticker: 'NVDA',
      companyName: 'NVIDIA',
      signalType: 'WHALE',
      score: 88,
      metrics: { premium_total: 2_500_000 },
    });
    expect(text).toContain('NVIDIA');
    expect(text).toContain('$2.50M');
  });

  it('handles INSIDER_DARKPOOL_CONFLUENCE with insider info', () => {
    const text = buildTemplateInsight({
      ticker: 'AAPL',
      companyName: 'Apple Inc.',
      signalType: 'INSIDER_DARKPOOL_CONFLUENCE',
      score: 92,
      metrics: {
        premium_total: 8_000_000,
        insider_name: 'Tim Cook',
        insider_value: 1_500_000,
        insider_days_ago: 4,
      },
    });
    expect(text).toContain('Tim Cook');
    expect(text).toContain('Apple Inc.');
    expect(text).toContain('לפני 4 ימים');
  });

  it('handles UNUSUAL_VOLUME and includes the ratio when given', () => {
    const text = buildTemplateInsight({
      ticker: 'TSLA',
      companyName: null,
      signalType: 'UNUSUAL_VOLUME',
      score: 70,
      metrics: { premium_total: 4_000_000, relative_volume: 5.4 },
    });
    expect(text).toContain('TSLA');
    expect(text).toContain('5.4');
  });

  it('handles HIDDEN_ACCUMULATION with net flow computation', () => {
    const text = buildTemplateInsight({
      ticker: 'AMD',
      companyName: 'AMD',
      signalType: 'HIDDEN_ACCUMULATION',
      score: 65,
      metrics: { premium_buy: 3_000_000, premium_sell: 1_000_000 },
    });
    expect(text).toContain('AMD');
    expect(text).toContain('$2.00M');
  });

  it('handles SWEEP with the number of prints', () => {
    const text = buildTemplateInsight({
      ticker: 'META',
      companyName: 'Meta',
      signalType: 'SWEEP',
      score: 70,
      metrics: { premium_total: 1_200_000, prints: 6 },
    });
    expect(text).toContain('6');
    expect(text).toContain('Meta');
  });
});

describe('generateAiInsight', () => {
  it('falls back to template when no AI provider configured', async () => {
    const text = await generateAiInsight(
      {
        ticker: 'NVDA',
        companyName: 'NVIDIA',
        signalType: 'WHALE',
        score: 70,
        metrics: { premium_total: 1_500_000 },
      },
      { forceTemplate: true }
    );
    expect(text).toContain('NVIDIA');
  });
});
