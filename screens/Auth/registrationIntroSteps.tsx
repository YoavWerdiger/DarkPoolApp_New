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

/** אימוג'י לכל אופציה — כרטיסי הבחירה בסגנון Cal AI */
function withEmoji<T extends string>(
  options: { label: string; value: T }[],
  emojis: Record<string, string>,
): { label: string; value: T; emoji?: string }[] {
  return options.map((o) => ({ ...o, emoji: emojis[o.value] }));
}

// הוספת emojis לאופציות רמת הניסיון
const EXPERIENCE_LEVEL_OPTIONS_WITH_EMOJI = [
  { ...EXPERIENCE_LEVEL_OPTIONS[0], emoji: '🌱' }, // עושה צעדים ראשונים
  { ...EXPERIENCE_LEVEL_OPTIONS[1], emoji: '📚' }, // סוחר מתחיל
  { ...EXPERIENCE_LEVEL_OPTIONS[2], emoji: '📈' }, // סוחר בינוני
  { ...EXPERIENCE_LEVEL_OPTIONS[3], emoji: '🚀' }, // סוחר מתקדם
];

const experienceConfig: IntroQuestionConfig = {
  field: 'experienceLevel',
  stepKey: 'experience',
  title: 'מה רמת הניסיון שלך במסחר?',
  subtitle: 'בחר את האפשרות הקרובה ביותר',
  options: EXPERIENCE_LEVEL_OPTIONS_WITH_EMOJI,
  nextRoute: 'RegistrationTradingFocus',
};

const focusConfig: IntroQuestionConfig = {
  field: 'tradingFocus',
  stepKey: 'tradingFocus',
  title: 'מה סגנון המסחר שלך?',
  subtitle: 'נוכל להציג תוכן רלוונטי יותר',
  options: withEmoji(TRADING_FOCUS_OPTIONS, { day_trading: '⚡️', swing: '🌊', long_term: '🏔️' }),
  nextRoute: 'RegistrationPlatform',
};

const platformConfig: IntroQuestionConfig = {
  field: 'tradingPlatform',
  stepKey: 'platform',
  title: 'באיזו פלטפורמה אתה סוחר?',
  subtitle: 'אפשר לבחור יותר מאחת',
  options: withEmoji(TRADING_PLATFORM_OPTIONS, {
    bank: '🏦',
    interactive_brokers: '🌐',
    tradestation: '📊',
    colmex: '💼',
    other: '✨',
  }),
  nextRoute: 'RegistrationPortfolio',
  multiple: true,
};

const portfolioConfig: IntroQuestionConfig = {
  field: 'portfolioSize',
  stepKey: 'portfolio',
  title: 'מה גודל התיק שלך?',
  subtitle: 'שאלה אופציונלית — אפשר לדלג',
  options: withEmoji(PORTFOLIO_SIZE_OPTIONS, {
    under_10k: '🌱',
    '10k_50k': '🌿',
    '50k_100k': '🌳',
    over_100k: '💎',
  }),
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
