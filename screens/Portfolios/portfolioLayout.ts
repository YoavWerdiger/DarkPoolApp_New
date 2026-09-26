/**
 * טופולוגיית תיקים / יומן מסחר — re-export של סקאלת Journal / APP_TYPE.
 * כותרת מסך: MainDrawerScreenHeader · כותרת סקשן מחוץ לכרטיס: sectionTitle (22)
 * · כותרת בתוך UICard soft: cardTitle (17) + cardSubtitle (13, +2px).
 */
export { APP_LAYOUT as PORTFOLIO_LAYOUT } from '../../components/ui/appLayout';
export {
  APP_TYPE as PORTFOLIO_TYPE,
  appPhysicalRightText as portfolioPhysicalRightText,
  appSectionTitleStyle as portfolioSectionTitleStyle,
  appSectionSubtitleStyle as portfolioSectionSubtitleStyle,
  appBodyTextStyle as portfolioBodyTextStyle,
  appCardTitleStyle as portfolioCardTitleStyle,
  appCardSubtitleStyle as portfolioCardSubtitleStyle,
  appCardBodyStyle as portfolioCardBodyStyle,
  appCardMetricLabelStyle as portfolioCardMetricLabelStyle,
  appCardMetricValueStyle as portfolioCardMetricValueStyle,
  appCardMetricValueSecondaryStyle as portfolioCardMetricValueSecondaryStyle,
  appCaptionStyle as portfolioCaptionStyle,
  appCaption2Style as portfolioCaption2Style,
} from '../../components/ui/appType';
export { PORTFOLIO_FORM } from './portfolioFormLayout';
export {
  JOURNAL_LAYOUT,
  JOURNAL_TYPE,
  journalRtlContent as portfolioRtlContent,
  journalRtlRoot as portfolioRtlRoot,
  journalRow as portfolioRow,
  journalPhysicalRightText,
  journalSectionTitleStyle,
  journalSectionSubtitleStyle,
  journalBodyTextStyle,
  journalCardTitleStyle,
  journalCardSubtitleStyle,
  journalCardBodyStyle,
  journalCardMetricLabelStyle,
  journalCardMetricValueStyle,
  journalCardMetricValueSecondaryStyle,
  journalCaptionStyle,
  journalCaption2Style,
} from '../Journal/journalLayout';
