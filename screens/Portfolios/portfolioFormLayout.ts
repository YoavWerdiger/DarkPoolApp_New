/**
 * טופולוגיית מסכי טופס בתיקים — APP_TYPE / formControl / journalLayout.
 */
/** ערכים קבועים — לא תלוי ב-APP_LAYOUT בזמן אתחול (מונע circular / undefined ב-HMR). */
export const PORTFOLIO_FORM = {
  screenPadH: 20,
  sectionGap: 16,
  fieldSpacing: 16,
  sectionHeaderToContent: 16,
} as const;

export {
  appFormFieldHelperStyle as portfolioFormHelperStyle,
  appFormFieldLabelStyle as portfolioFormLabelStyle,
} from '../../components/ui/appType';
