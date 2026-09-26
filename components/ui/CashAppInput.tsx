import React from 'react';
import OnboardingInput from '../onboarding/OnboardingInput';

type AutoFormatMode = 'phone' | 'none';

export interface CashAppInputProps extends React.ComponentProps<typeof OnboardingInput> {
  autoFormat?: AutoFormatMode;
}

const formatIsraeliPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const CashAppInput: React.FC<CashAppInputProps> = ({
  autoFormat = 'none',
  value,
  onChangeText,
  ...rest
}) => {
  const textValue = typeof value === 'string' ? value : '';
  const displayValue = autoFormat === 'phone' ? formatIsraeliPhone(textValue) : textValue;

  return (
    <OnboardingInput
      {...rest}
      value={displayValue}
      onChangeText={(text) => {
        if (autoFormat === 'phone') {
          onChangeText?.(formatIsraeliPhone(text));
          return;
        }
        onChangeText?.(text);
      }}
    />
  );
};

export default CashAppInput;
