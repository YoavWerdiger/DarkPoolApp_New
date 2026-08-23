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
  displayMode: 'swipe',
};

const focusConfig: IntroQuestionConfig = {
  field: 'tradingFocus',
  stepKey: 'tradingFocus',
  title: 'מה סגנון המסחר שלך?',
  subtitle: 'נוכל להציג תוכן רלוונטי יותר',
  options: TRADING_FOCUS_OPTIONS,
  nextRoute: 'RegistrationPlatform',
};

const platformConfig: IntroQuestionConfig = {
  field: 'tradingPlatform',
  stepKey: 'platform',
  title: 'באיזו פלטפורמה אתה סוחר?',
  subtitle: 'אפשר לבחור יותר מאחת',
  options: TRADING_PLATFORM_OPTIONS,
  nextRoute: 'RegistrationPortfolio',
  multiple: true,
};

const portfolioConfig: IntroQuestionConfig = {
  field: 'portfolioSize',
  stepKey: 'portfolio',
  title: 'מה גודל התיק שלך?',
  subtitle: 'שאלה אופציונלית — אפשר לדלג',
  options: PORTFOLIO_SIZE_OPTIONS,
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
