import React from 'react';
import RegistrationIntroQuestionScreen, {
  type IntroQuestionConfig,
} from './RegistrationIntroQuestionScreen';
import RegistrationAgeInputScreen from './RegistrationAgeInputScreen';
import {
  EXPERIENCE_LEVEL_OPTIONS,
  TRADING_FOCUS_OPTIONS,
  TRADING_PLATFORM_OPTIONS,
  PORTFOLIO_SIZE_OPTIONS,
} from '../../constants/onboardingQuestionnaire';

type IconName = React.ComponentProps<typeof import('@expo/vector-icons').Ionicons>['name'];

/** אייקון קו לכל אופציה (במקום אימוג'י — נראה מקצועי ואחיד) */
function withIcons<T extends string>(
  options: { label: string; value: T }[],
  icons: Record<string, IconName>,
) {
  return options.map((o) => ({ ...o, icon: icons[o.value] }));
}

/** רמת ניסיון — מד 1–4 + הסבר קצר */
const EXPERIENCE_DETAILS: Record<string, { level: number; description: string }> = {
  first_steps: { level: 1, description: 'עוד לא ביצעתי עסקאות בשוק' },
  beginner: { level: 2, description: 'מסחר ראשון, פחות משנה בשוק' },
  intermediate: { level: 3, description: 'כמה שנים של מסחר פעיל' },
  advanced: { level: 4, description: 'מסחר שיטתי עם אסטרטגיה מוגדרת' },
};
const EXPERIENCE_LEVEL_OPTIONS_DETAILED = EXPERIENCE_LEVEL_OPTIONS.map((o) => ({
  ...o,
  ...EXPERIENCE_DETAILS[o.value],
}));

const experienceConfig: IntroQuestionConfig = {
  field: 'experienceLevel',
  stepKey: 'experience',
  title: 'מה רמת הניסיון שלך במסחר?',
  subtitle: 'בחר את האפשרות הקרובה ביותר',
  options: EXPERIENCE_LEVEL_OPTIONS_DETAILED,
  nextRoute: 'RegistrationTradingFocus',
};

const focusConfig: IntroQuestionConfig = {
  field: 'tradingFocus',
  stepKey: 'tradingFocus',
  title: 'מה סגנון המסחר שלך?',
  subtitle: 'נוכל להציג תוכן רלוונטי יותר',
  options: withIcons(TRADING_FOCUS_OPTIONS, {
    day_trading: 'flash-outline',
    swing: 'pulse-outline',
    long_term: 'trending-up-outline',
  }),
  nextRoute: 'RegistrationPlatform',
};

const platformConfig: IntroQuestionConfig = {
  field: 'tradingPlatform',
  stepKey: 'platform',
  title: 'באיזו פלטפורמה אתה סוחר?',
  subtitle: 'אפשר לבחור יותר מאחת',
  options: withIcons(TRADING_PLATFORM_OPTIONS, {
    bank: 'business-outline',
    interactive_brokers: 'globe-outline',
    tradestation: 'stats-chart-outline',
    colmex: 'briefcase-outline',
    other: 'ellipsis-horizontal',
  }),
  nextRoute: 'RegistrationPortfolio',
  multiple: true,
};

const portfolioConfig: IntroQuestionConfig = {
  field: 'portfolioSize',
  stepKey: 'portfolio',
  title: 'מה גודל התיק שלך?',
  subtitle: 'שאלה אופציונלית — אפשר לדלג',
  options: PORTFOLIO_SIZE_OPTIONS.map((o, i) => ({ ...o, level: i + 1 })),
  nextRoute: 'RegistrationTrack',
  optional: true,
  allowDeselect: true,
};

export const RegistrationAgeScreen = ({ navigation }: { navigation: any }) => (
  <RegistrationAgeInputScreen navigation={navigation} />
);

export const RegistrationExperienceScreen = ({ navigation }: { navigation: any }) => (
  <RegistrationIntroQuestionScreen navigation={navigation} config={experienceConfig} />
);

export const RegistrationTradingFocusScreen = ({ navigation }: { navigation: any }) => (
  <RegistrationIntroQuestionScreen navigation={navigation} config={focusConfig} />
);

export const RegistrationPlatformScreen = ({ navigation }: { navigation: any }) => (
  <RegistrationIntroQuestionScreen navigation={navigation} config={platformConfig} />
);

export const RegistrationPortfolioScreen = ({ navigation }: { navigation: any }) => (
  <RegistrationIntroQuestionScreen navigation={navigation} config={portfolioConfig} />
);
