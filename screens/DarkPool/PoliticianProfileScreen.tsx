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
}

export function PoliticianProfileScreen({
  politicianId,
  nameHint,
  imageHint,
  onBack,
}: Props) {
  return (
    <PersonPortfolioProfileScreen
      id={politicianId}
      kind="politician"
      nameHint={nameHint}
      imageHint={imageHint}
      onBack={onBack}
    />
  );
}
