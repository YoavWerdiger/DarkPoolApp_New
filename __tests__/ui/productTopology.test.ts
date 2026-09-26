import { readFileSync } from 'fs';
import { join } from 'path';
import { APP_TYPE } from '../../components/ui/appType';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { PRODUCT_MODULES, PRODUCT_TOPOLOGY } from '../../components/ui/productTopology';
import { JOURNAL_TYPE, JOURNAL_LAYOUT } from '../../screens/Journal/journalLayout';
import { PORTFOLIO_TYPE, PORTFOLIO_LAYOUT } from '../../screens/Portfolios/portfolioLayout';
import { DARK_POOL_TYPE } from '../../screens/DarkPool/darkPoolLayout';
import { ACADEMY_TYPE, ACADEMY_LAYOUT } from '../../components/learning/academyLayout';
import { CHAT_TYPE, CHAT_LAYOUT } from '../../components/chat/chatLayout';
import { MARKETS_TYPE, MARKETS_LAYOUT } from '../../screens/Markets/marketsLayout';
import { SETTINGS_TYPE } from '../../components/profile/settingsType';
import { PORTFOLIO_FORM } from '../../screens/Portfolios/portfolioFormLayout';

const root = join(__dirname, '../..');

function readRel(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

describe('product topology registry', () => {
  it('lists all product modules with layout entry paths', () => {
    const ids = PRODUCT_MODULES.map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'journal',
        'portfolios',
        'darkPool',
        'academy',
        'chat',
        'markets',
        'settings',
        'auth',
      ]),
    );
    for (const mod of PRODUCT_MODULES) {
      expect(readRel(mod.layoutEntry)).toBeTruthy();
    }
  });

  it('PRODUCT_TOPOLOGY mirrors APP_TYPE and APP_LAYOUT rhythm', () => {
    expect(PRODUCT_TOPOLOGY.type).toBe(APP_TYPE);
    expect(PRODUCT_TOPOLOGY.layout).toBe(APP_LAYOUT);
    expect(PRODUCT_TOPOLOGY.cardTitleToSubtitleGap).toBe(2);
    expect(PRODUCT_TOPOLOGY.cardStackGap).toBe(16);
    expect(PRODUCT_TOPOLOGY.screenPaddingHorizontal).toBe(20);
  });
});

describe('module TYPE re-exports (single scale)', () => {
  it('every module TYPE alias is APP_TYPE', () => {
    expect(JOURNAL_TYPE).toBe(APP_TYPE);
    expect(PORTFOLIO_TYPE).toBe(APP_TYPE);
    expect(DARK_POOL_TYPE).toBe(APP_TYPE);
    expect(ACADEMY_TYPE).toBe(APP_TYPE);
    expect(CHAT_TYPE).toBe(APP_TYPE);
    expect(MARKETS_TYPE).toBe(APP_TYPE);
    expect(SETTINGS_TYPE).toBe(APP_TYPE);
  });

  it('layout aliases are APP_LAYOUT where defined', () => {
    expect(JOURNAL_LAYOUT).toBe(APP_LAYOUT);
    expect(PORTFOLIO_LAYOUT).toBe(APP_LAYOUT);
    expect(ACADEMY_LAYOUT).toBe(APP_LAYOUT);
    expect(CHAT_LAYOUT).toBe(APP_LAYOUT);
    expect(MARKETS_LAYOUT).toBe(APP_LAYOUT);
  });
});

describe('cross-module implementation guards', () => {
  it('journal and portfolios use journal card/section styles', () => {
    expect(readRel('screens/Journal/JournalDataTab.tsx')).toMatch(/journalLayout/);
    expect(readRel('screens/Portfolios/components/PortfolioCard.tsx')).toMatch(
      /journalCardTitleStyle/,
    );
  });

  it('academy cards use appCard* styles', () => {
    expect(readRel('components/learning/LessonRow.tsx')).toMatch(/appCardTitleStyle/);
    expect(readRel('components/learning/academyLayout.ts')).toMatch(/ACADEMY_TYPE/);
  });

  it('dark pool feed derives FEED_CARD_TYPE from APP_TYPE', () => {
    const feedStyles = readRel('screens/DarkPool/components/darkPoolFeedCardStyles.ts');
    expect(feedStyles).toMatch(/APP_TYPE\.cardTitle/);
    expect(feedStyles).not.toMatch(/DARK_POOL_TYPE/);
  });

  it('portfolio forms use formControl and shared footer', () => {
    expect(readRel('screens/Portfolios/components/PortfolioFormFields.tsx')).toMatch(
      /formFieldShellStyle/,
    );
    expect(readRel('screens/Portfolios/CreatePortfolioScreen.tsx')).toMatch(
      /PortfolioFormFooter/,
    );
    expect(PORTFOLIO_FORM.screenPadH).toBe(APP_LAYOUT.screenPaddingHorizontal);
  });

  it('auth onboarding uses formControl without green field borders', () => {
    const onboarding = readRel('components/onboarding/OnboardingInput.tsx');
    expect(onboarding).toMatch(/formFieldShellStyle/);
    expect(onboarding).not.toMatch(/primary\.main.*borderColor/);
    expect(readRel('components/onboarding/OnboardingLayout.tsx')).toMatch(/appFlowTitleStyle/);
  });

  it('settings/group info use SETTINGS_TYPE scale', () => {
    expect(readRel('components/profile/ProfileSettingsUI.tsx')).toMatch(/settingsType/);
  });

  it('markets grid and tabs import marketsLayout (no orphan fontSize)', () => {
    expect(readRel('screens/Markets/components/MarketsSectionGrid.tsx')).toMatch(
      /marketsLayout/,
    );
    expect(readRel('screens/Markets/components/MarketsUnderlineTabs.tsx')).toMatch(
      /marketsLayout/,
    );
    expect(readRel('screens/Markets/components/MarketsSectionGrid.tsx')).not.toMatch(
      /fontSize:\s*14,/,
    );
  });

  it('chat layout re-exports APP_TYPE', () => {
    expect(readRel('components/chat/chatLayout.ts')).toMatch(/CHAT_TYPE/);
  });

  it('typography doc references cursor rule and all test files', () => {
    const doc = readRel('docs/TYPOGRAPHY_AND_FORM_TOPOLOGY.md');
    expect(doc).toMatch(/typography-form-topology\.mdc/);
    expect(doc).toMatch(/productTopology\.test\.ts/);
    expect(doc).toMatch(/portfolioFormFields\.test\.ts/);
    expect(doc).toMatch(/## 4\.5 היררכיית KPI ומספרים/);
    expect(doc).toMatch(/JournalHeroKpis/);
  });
});
