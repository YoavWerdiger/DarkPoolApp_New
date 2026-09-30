import { readFileSync } from 'fs';
import { join } from 'path';

const journalSrc = readFileSync(
  join(__dirname, '../../screens/Journal/JournalDataTab.tsx'),
  'utf8',
);

describe('Journal hero KPI layout', () => {
  it('centers total P&L and win rate in one summary card', () => {
    expect(journalSrc).toContain('JournalHeroKpis');
    expect(journalSrc).toContain('kpiHeroCol');
    expect(journalSrc).toContain('kpiMetricValueHero');
    expect(journalSrc).toMatch(
      /kpiMetricValueHero:\s*\{[\s\S]*journalCardTitleStyle/,
    );
    expect(journalSrc).not.toMatch(
      /JournalHeroKpis[\s\S]*KpiBlock title="P&L כולל"/,
    );
  });
});
