import { buildPersonAttachment } from '../../types/shareableEntity';

describe('buildPersonAttachment portfolio preview', () => {
  it('embeds holdings chart when at least two slices', () => {
    const att = buildPersonAttachment({
      id: 'P000197',
      kind: 'politician',
      name: 'Nancy Pelosi',
      portfolioValue: 12_000_000,
      holdingsChart: [
        { ticker: 'NVDA', pct: 40, color: '#00C805' },
        { ticker: 'AAPL', pct: 35, color: '#3B82F6' },
      ],
    });
    expect(att.preview.metrics?.portfolio_value).toBeDefined();
    expect(att.preview.holdingsChart).toHaveLength(2);
  });

  it('drops chart with fewer than two slices', () => {
    const att = buildPersonAttachment({
      id: 'x',
      kind: 'insider',
      name: 'Test',
      holdingsChart: [{ ticker: 'NVDA', pct: 100, color: '#fff' }],
    });
    expect(att.preview.holdingsChart).toBeUndefined();
  });
});
