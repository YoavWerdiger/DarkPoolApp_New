/**
 * Router → פרופיל אדם מאוחד (גרף שווי תיק כ-HERO).
 */

import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import type { DarkPoolStackParamList } from '../../navigation/DarkPoolStack';
import { useDarkPoolStackNav } from './hooks/useDarkPoolStackNav';
import { PersonPortfolioProfileScreen } from './PersonPortfolioProfileScreen';

type Route = RouteProp<DarkPoolStackParamList, 'DarkPoolInvestor'>;

export default function DarkPoolInvestorProfileScreen() {
  const stackNav = useDarkPoolStackNav();
  const route = useRoute<Route>();
  const { id, kind, ticker, nameHint, imageHint } = route.params;

  return (
    <PersonPortfolioProfileScreen
      id={id}
      kind={kind}
      ticker={ticker}
      nameHint={nameHint}
      imageHint={imageHint}
      onBack={() => stackNav.goBack()}
      onTickerPress={(t) =>
        stackNav.navigate('DarkPoolTicker', {
          ticker: t,
          tab: kind === 'insider' ? 'insider' : undefined,
        })
      }
    />
  );
}
