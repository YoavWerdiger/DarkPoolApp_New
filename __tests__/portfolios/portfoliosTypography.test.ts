import { readFileSync } from 'fs';
import { join } from 'path';
import { PORTFOLIO_LAYOUT } from '../../screens/Portfolios/portfolioLayout';

const portfolioCardSrc = readFileSync(
  join(__dirname, '../../screens/Portfolios/components/PortfolioCard.tsx'),
  'utf8',
);
const overviewSrc = readFileSync(
  join(__dirname, '../../screens/Portfolios/tabs/OverviewTab.tsx'),
  'utf8',
);

describe('portfolios typography (journal topology)', () => {
  it('exports shared layout gaps', () => {
    expect(PORTFOLIO_LAYOUT.cardTitleToSubtitleGap).toBe(2);
    expect(PORTFOLIO_LAYOUT.cardStackGap).toBe(12);
  });

  it('PortfolioCard uses soft UICard and card title/subtitle tokens', () => {
    expect(portfolioCardSrc).toContain('variant="soft"');
    expect(portfolioCardSrc).toContain('journalCardTitleStyle');
    expect(portfolioCardSrc).toContain('journalCardSubtitleStyle');
    expect(portfolioCardSrc).toContain('journalCardMetricValueStyle');
    expect(portfolioCardSrc).toContain('journalCardMetricValueSecondaryStyle');
    expect(portfolioCardSrc).toMatch(
      /valueAmount:[\s\S]*journalCardMetricValueStyle/,
    );
    expect(portfolioCardSrc).toMatch(/kpiValue:[\s\S]*journalCardMetricValueSecondaryStyle/);
    expect(portfolioCardSrc).toContain('titleLatin');
    expect(portfolioCardSrc).toMatch(/titleLatin:[\s\S]*writingDirection:\s*'ltr'/);
    expect(portfolioCardSrc).toContain('background.cardSolid');
    expect(portfolioCardSrc).not.toMatch(/fontSize:\s*10/);
    expect(portfolioCardSrc).toMatch(/titleBlock:\s*\{[^}]*direction:\s*'ltr'/);
  });

  it('OverviewTab uses in-card section titles (cardTitle tier)', () => {
    expect(overviewSrc).toContain('journalCardTitleStyle');
    expect(overviewSrc).toContain('JOURNAL_LAYOUT.cardStackGap');
  });
});
