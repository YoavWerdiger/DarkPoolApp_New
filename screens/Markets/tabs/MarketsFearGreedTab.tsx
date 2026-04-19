import React from 'react';
import { View, ScrollView } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import FearAndGreedCard from '../../../components/News/FearAndGreedCard';

type Props = { mainTabsHeight: number };

export function MarketsFearGreedTab({ mainTabsHeight }: Props) {
  const tokens = useDesignTokens();

  return (
    <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: tokens.spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <FearAndGreedCard initialExpanded disableToggle fullWidth />
      </ScrollView>
    </View>
  );
}
