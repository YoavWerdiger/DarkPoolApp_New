import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Maximize2, X } from 'lucide-react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import {
  getTradingViewHeatmapHTML,
  type HeatmapKind,
} from '../embeds/tradingViewEmbeds';
import { MarketsTradingView } from '../components/MarketsTradingView';
import { MarketsSegmentedControl } from '../components/MarketsSegmentedControl';

const WEB_SOURCE_BASE = 'https://tradingview.com';

const HEATMAP_SEGMENTS: { id: HeatmapKind; label: string }[] = [
  { id: 'crypto', label: 'קריפטו' },
  { id: 'nasdaq', label: 'Nasdaq' },
  { id: 'sp500', label: 'S&P500' },
];

type Props = { mainTabsHeight: number };

export function MarketsHeatmapsTab({ mainTabsHeight }: Props) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const [heatmapType, setHeatmapType] = useState<HeatmapKind>('sp500');
  const [fullscreenHeatmap, setFullscreenHeatmap] = useState(false);

  const heatmapHtml = useMemo(() => getTradingViewHeatmapHTML(heatmapType), [heatmapType]);

  const openFullscreenHeatmap = useCallback(() => {
    setFullscreenHeatmap(true);
  }, []);

  const closeFullscreenHeatmap = useCallback(() => {
    setFullscreenHeatmap(false);
  }, []);

  return (
    <View style={{ flex: 1, paddingHorizontal: tokens.spacing.lg, marginBottom: mainTabsHeight - 12 }}>
      <UICard
        variant="blur"
        padding="none"
        style={{
          borderRadius: tokens.borderRadius['3xl'],
          overflow: 'hidden',
          marginBottom: tokens.spacing.md,
        }}
      >
        <MarketsSegmentedControl
          options={HEATMAP_SEGMENTS}
          value={heatmapType}
          onChange={setHeatmapType}
          accessibilityGroupLabel="מפת חום"
        />
      </UICard>

      <TouchableOpacity
        onPress={openFullscreenHeatmap}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.colors.background.cardSolid,
          borderRadius: tokens.borderRadius.sm,
          padding: tokens.spacing.sm,
          marginBottom: tokens.spacing.sm,
          gap: tokens.spacing.sm,
        }}
        accessibilityRole="button"
        accessibilityLabel="מפת חום במסך מלא"
      >
        <Maximize2 size={tokens.typography.bodySmall.size} color={tokens.colors.text.secondary} />
        <Text style={{ fontSize: tokens.typography.caption.size, color: tokens.colors.text.secondary }}>
          מסך מלא (סובב)
        </Text>
      </TouchableOpacity>

      <UICard
        variant="blur"
        padding="none"
        style={{ flex: 1, ...tokens.shadows.lg, minHeight: 0 }}
        contentContainerStyle={{ flex: 1, minHeight: 0 }}
      >
        <View style={{ flex: 1, borderRadius: tokens.borderRadius.lg, overflow: 'hidden', minHeight: 0 }}>
          <MarketsTradingView
            html={heatmapHtml}
            instanceKey={`heatmap-${heatmapType}`}
            flexFill
          />
        </View>
      </UICard>

      <Modal
        visible={fullscreenHeatmap}
        animationType="fade"
        statusBarTranslucent
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={closeFullscreenHeatmap}
      >
        <View style={{ flex: 1, backgroundColor: tokens.colors.background.primary }}>
          <TouchableOpacity
            onPress={closeFullscreenHeatmap}
            style={{
              position: 'absolute',
              top: insets.top + 8,
              right: tokens.spacing.lg,
              zIndex: 100,
              width: 44,
              height: 44,
              borderRadius: tokens.borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tokens.colors.overlay,
              borderWidth: 1,
              borderColor: tokens.colors.border.primary,
              ...tokens.shadows.sm,
            }}
            accessibilityRole="button"
            accessibilityLabel="סגור מסך מלא"
          >
            <X size={tokens.typography.fontSize.xl} color={tokens.colors.text.primary} />
          </TouchableOpacity>

          <WebView
            source={{ html: heatmapHtml, baseUrl: WEB_SOURCE_BASE }}
            style={{ flex: 1 }}
            scrollEnabled
            nestedScrollEnabled
            javaScriptEnabled
            domStorageEnabled
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            scalesPageToFit={Platform.OS === 'android'}
            androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
            originWhitelist={['*']}
            mixedContentMode="always"
          />
        </View>
      </Modal>
    </View>
  );
}
