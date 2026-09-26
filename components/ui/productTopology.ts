/**
 * מפת טופולוגיית מוצר — מקור אמת לכל המערכות.
 * docs/TYPOGRAPHY_AND_FORM_TOPOLOGY.md
 *
 * כל מודול מייבא דרך `*Layout.ts` / `settingsType.ts` — לא fontSize חד-פעמי במסכים.
 */
import { APP_LAYOUT } from './appLayout';
import { APP_TYPE } from './appType';

/** מזהי מערכות באפליקציה */
export type ProductModuleId =
  | 'core'
  | 'auth'
  | 'journal'
  | 'portfolios'
  | 'darkPool'
  | 'academy'
  | 'chat'
  | 'markets'
  | 'settings'
  | 'profile';

export type ProductModuleSpec = {
  id: ProductModuleId;
  /** קובץ ייבוא טיפוגרפיה למפתחים */
  layoutEntry: string;
  /** שם export של סקאלת TYPE (חייב להיות APP_TYPE) */
  typeExport: string;
  /** שם export של מרווחים (חייב להיות APP_LAYOUT) */
  layoutExport?: string;
  /** טפסים — formControl / קומפוננטות שדה */
  forms?: string;
};

/** רישום מודולים — עדכן כאן כשמוסיפים מערכת חדשה */
export const PRODUCT_MODULES: readonly ProductModuleSpec[] = [
  {
    id: 'core',
    layoutEntry: 'components/ui/appType.ts',
    typeExport: 'APP_TYPE',
    layoutExport: 'APP_LAYOUT',
    forms: 'components/ui/formControl.ts',
  },
  {
    id: 'auth',
    layoutEntry: 'components/ui/appType.ts',
    typeExport: 'APP_TYPE',
    forms: 'OnboardingInput, CashAppInput, UIInput, OtpInput → formControl',
  },
  {
    id: 'journal',
    layoutEntry: 'screens/Journal/journalLayout.ts',
    typeExport: 'JOURNAL_TYPE',
    layoutExport: 'JOURNAL_LAYOUT',
  },
  {
    id: 'portfolios',
    layoutEntry: 'screens/Portfolios/portfolioLayout.ts',
    typeExport: 'PORTFOLIO_TYPE',
    layoutExport: 'PORTFOLIO_LAYOUT',
    forms: 'PortfolioFormFields, portfolioFormLayout.ts',
  },
  {
    id: 'darkPool',
    layoutEntry: 'screens/DarkPool/darkPoolLayout.ts',
    typeExport: 'DARK_POOL_TYPE',
    forms: 'screens/DarkPool/components/darkPoolFeedCardStyles.ts (FEED_CARD_TYPE)',
  },
  {
    id: 'academy',
    layoutEntry: 'components/learning/academyLayout.ts',
    typeExport: 'ACADEMY_TYPE',
    layoutExport: 'ACADEMY_LAYOUT',
  },
  {
    id: 'chat',
    layoutEntry: 'components/chat/chatLayout.ts',
    typeExport: 'CHAT_TYPE',
    layoutExport: 'CHAT_LAYOUT',
  },
  {
    id: 'markets',
    layoutEntry: 'screens/Markets/marketsLayout.ts',
    typeExport: 'MARKETS_TYPE',
    layoutExport: 'MARKETS_LAYOUT',
  },
  {
    id: 'settings',
    layoutEntry: 'components/profile/settingsType.ts',
    typeExport: 'SETTINGS_TYPE',
  },
  {
    id: 'profile',
    layoutEntry: 'components/profile/settingsType.ts',
    typeExport: 'SETTINGS_TYPE',
  },
] as const;

/** מרווחים וטופולוגיית כרטיס — זהים בכל המערכות */
export const PRODUCT_TOPOLOGY = {
  type: APP_TYPE,
  layout: APP_LAYOUT,
  cardStackGap: APP_LAYOUT.cardStackGap,
  cardTitleToSubtitleGap: APP_LAYOUT.cardTitleToSubtitleGap,
  cardTitleToBodyGap: APP_LAYOUT.cardTitleToBodyGap,
  sectionHeaderToContent: APP_LAYOUT.sectionHeaderToContent,
  screenPaddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
} as const;
