/**
 * @deprecated — השתמש ב-PersonPortfolioProfileScreen.
 * נשאר לתאימות; מפנה למסך המאוחד.
 */

import React from 'react';
import { PersonPortfolioProfileScreen } from './PersonPortfolioProfileScreen';

interface Props {
  politicianId: string;
  nameHint?: string;
  imageHint?: string | null;
  onBack: () => void;
  onTickerPress: (ticker: string) => void;
}

export function PoliticianProfileScreen({
  politicianId,
  nameHint,
  imageHint,
  onBack,
  onTickerPress,
}: Props) {
  return (
    <PersonPortfolioProfileScreen
      id={politicianId}
      kind="politician"
      nameHint={nameHint}
      imageHint={imageHint}
      onBack={onBack}
      onTickerPress={onTickerPress}
    />
  );
}
