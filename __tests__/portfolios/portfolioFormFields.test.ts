import { readFileSync } from 'fs';
import { join } from 'path';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { PRODUCT_TOPOLOGY } from '../../components/ui/productTopology';
import { PORTFOLIO_FORM } from '../../screens/Portfolios/portfolioFormLayout';

const root = join(__dirname, '../..');

function readRel(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

const fieldsSrc = readRel('screens/Portfolios/components/PortfolioFormFields.tsx');
const createSrc = readRel('screens/Portfolios/CreatePortfolioScreen.tsx');
const connectSrc = readRel('screens/Portfolios/ConnectBrokerScreen.tsx');
const selectBrokerSrc = readRel('screens/Portfolios/SelectBrokerAccountScreen.tsx');
const addTxSrc = readRel('screens/Portfolios/AddTransactionScreen.tsx');
const importSrc = readRel('screens/Portfolios/ImportTransactionsScreen.tsx');
const portfoliosTabSrc = readRel('screens/Portfolios/PortfoliosTab.tsx');

describe('portfolio form topology', () => {
  it('aligns PORTFOLIO_FORM with global PRODUCT_TOPOLOGY rhythm', () => {
    expect(PORTFOLIO_FORM.screenPadH).toBe(PRODUCT_TOPOLOGY.screenPaddingHorizontal);
    expect(PORTFOLIO_FORM.fieldSpacing).toBe(PRODUCT_TOPOLOGY.cardStackGap);
    expect(PORTFOLIO_FORM.screenPadH).toBe(APP_LAYOUT.screenPaddingHorizontal);
    expect(PORTFOLIO_FORM.fieldSpacing).toBe(12);
  });

  it('PortfolioFormFields uses formControl and journal section titles', () => {
    expect(fieldsSrc).toMatch(/formFieldShellStyle/);
    expect(fieldsSrc).toMatch(/formFieldLabelStyle/);
    expect(fieldsSrc).toMatch(/journalSectionTitleStyle/);
    expect(fieldsSrc).not.toMatch(/borderColor: tokens\.colors\.primary\.main/);
    expect(fieldsSrc).toMatch(/PasswordVisibilityToggle/);
    expect(fieldsSrc).toMatch(/passwordShell/);
  });

  it('create and connect screens use PortfolioFormFooter and PORTFOLIO_FORM', () => {
    expect(createSrc).toMatch(/PortfolioFormFooter/);
    expect(createSrc).toMatch(/PORTFOLIO_FORM/);
    expect(createSrc).toMatch(/variant="soft"/);
    expect(connectSrc).toMatch(/PortfolioFormFooter/);
    expect(connectSrc).toMatch(/secureTextEntry/);
    expect(connectSrc).not.toMatch(/FormLabelLink/);
    expect(connectSrc).not.toMatch(/labelAccessory/);
  });

  it('broker select, add transaction, and import use shared form padding', () => {
    for (const src of [selectBrokerSrc, addTxSrc, importSrc]) {
      expect(src).toMatch(/PORTFOLIO_FORM/);
    }
    expect(selectBrokerSrc).toMatch(/PortfolioFormFooter/);
    expect(importSrc).toMatch(/variant="soft"/);
  });

  it('portfolio module is registered in productTopology', () => {
    const doc = readRel('docs/TYPOGRAPHY_AND_FORM_TOPOLOGY.md');
    expect(doc).toMatch(/productTopology\.ts/);
    expect(doc).toMatch(/PortfolioFormFields/);
    expect(doc).toMatch(/## 4\.5 היררכיית KPI ומספרים/);
    expect(doc).toMatch(/cardMetricValueSecondary/);
    expect(doc).toMatch(/PortfoliosTab/);
    expect(doc).toMatch(/PRODUCT_TOPOLOGY/);
  });

  it('PortfoliosTab search shell has no border; filter uses navChrome chrome', () => {
    expect(portfoliosTabSrc).toMatch(/searchCardWrap/);
    expect(portfoliosTabSrc).toMatch(/background\.input/);
    expect(portfoliosTabSrc).toMatch(/searchCardWrap:[\s\S]*borderWidth:\s*0/);
    expect(portfoliosTabSrc).toMatch(/sortBtnWrap:[\s\S]*background\.navChrome/);
    expect(portfoliosTabSrc).toMatch(/sortBtnWrap:[\s\S]*borderWidth:\s*0/);
    expect(portfoliosTabSrc).toMatch(/JOURNAL_TYPE\.body\.fontSize/);
    expect(portfoliosTabSrc).not.toMatch(/searchCardWrap:[\s\S]*borderWidth:\s*1/);
  });

  it('PRODUCT_TOPOLOGY rhythm matches portfolio form and list padding', () => {
    expect(PRODUCT_TOPOLOGY.cardStackGap).toBe(PRODUCT_TOPOLOGY.layout.cardStackGap);
    expect(PRODUCT_TOPOLOGY.type.cardMetricValue.fontSize).toBe(28);
    expect(PRODUCT_TOPOLOGY.type.cardMetricValueSecondary.fontSize).toBe(20);
    expect(portfoliosTabSrc).toMatch(/tokens\.layout\.screenPadding/);
  });
});
