/**
 * @deprecated — השתמש ב-PersonPortfolioProfileScreen.
 * נשאר לתאימות; מפנה למסך המאוחד.
 */

import React from 'react';
import { PersonPortfolioProfileScreen } from './PersonPortfolioProfileScreen';

interface Props {
  cik: string;
  nameHint?: string;
  imageHint?: string | null;
  onBack: () => void;
  onTickerPress: (ticker: string) => void;
}

export function FundManagerProfileScreen({
  cik,
  nameHint,
  imageHint,
  onBack,
  onTickerPress,
}: Props) {
  return (
    <PersonPortfolioProfileScreen
      id={cik}
      kind="fund_manager"
      nameHint={nameHint}
      imageHint={imageHint}
      onBack={onBack}
      onTickerPress={onTickerPress}
    />
  );
}
