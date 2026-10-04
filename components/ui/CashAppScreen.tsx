import React from 'react';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import OnboardingLayout from '../onboarding/OnboardingLayout';

type CashAppProgressVariant = 'dots' | 'bar' | 'none';

export interface CashAppScreenProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  showClose?: boolean;
  onClose?: () => void;
  currentStep: number;
  totalSteps: number;
  progressVariant?: CashAppProgressVariant;
  /** תוכן גליל (מסכים ארוכים / עם מקלדת) */
  scrollable?: boolean;
  style?: ViewStyle;
}

const CashAppScreen: React.FC<CashAppScreenProps> = (props) => {
  const { progressVariant = 'dots', ...rest } = props;
  return <OnboardingLayout {...rest} showProgress={progressVariant !== 'none'} />;
};

export default CashAppScreen;
