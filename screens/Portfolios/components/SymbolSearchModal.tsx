import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../../components/ui/DayNavBlurButton';
import { ChatSessionBackdrop } from '../../../components/chat/ChatSessionBackdrop';
import {
  searchSymbols,
  type SymbolSearchResult,
} from '../../../services/portfolios/portfolioPriceFeed';
import { hebrewAssetTypeLabel } from '../../../services/portfolios/symbolSearchFilter';
import { TickerLogo } from './TickerLogo';
import { HapticFeedback } from '../../../utils/hapticFeedback';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (result: SymbolSearchResult) => void;
}

/**
 * חיפוש סימבול — UICard + סינון מניות אמריקאיות (בלי listings זרים).
 */
export function SymbolSearchModal({ visible, onClose, onSelect }: Props) {
  const tokens = useDesignTokens();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      const r = await searchSymbols(query);
      setResults(r);
      setLoading(false);
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        outer: {
          flex: 1,
          backgroundColor: tokens.colors.background.primary,
        },
        safe: {
          flex: 1,
          backgroundColor: 'transparent',
        },
        header: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: tokens.layout.screenPadding,
          paddingVertical: 12,
          gap: 10,
        },
        searchCard: {
          flex: 1,
          borderRadius: tokens.borderRadius['2xl'],
          overflow: 'hidden',
        },
        searchInner: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 12,
          gap: 8,
        },
        searchInput: {
          flex: 1,
          fontSize: 15,
          fontWeight: '500',
          color: tokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'rtl',
          padding: 0,
        },
        hint: {
          paddingHorizontal: tokens.layout.screenPadding,
          paddingBottom: 8,
          color: tokens.colors.text.tertiary,
          fontSize: 12,
          fontWeight: '500',
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        list: {
          flex: 1,
          backgroundColor: 'transparent',
        },
        listContent: {
          paddingHorizontal: tokens.layout.screenPadding,
          paddingTop: 4,
          paddingBottom: 32,
        },
        rowCard: {
          borderRadius: tokens.borderRadius['2xl'],
          overflow: 'hidden',
          marginBottom: 8,
        },
        rowInner: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: 14,
          gap: 12,
        },
        rowPressed: {
          opacity: 0.9,
        },
        textBlock: {
          flex: 1,
          minWidth: 0,
          alignItems: 'flex-end',
          gap: 2,
        },
        symbolText: {
          fontSize: 16,
          fontWeight: '800',
          color: tokens.colors.text.primary,
          textAlign: 'right',
        },
        descriptionText: {
          fontSize: 12,
          fontWeight: '500',
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        typeChip: {
          paddingVertical: 5,
          paddingHorizontal: 10,
          borderRadius: tokens.borderRadius.full,
          backgroundColor: tokens.colors.primary.dim,
          borderWidth: 1,
          borderColor: tokens.colors.border.accent,
        },
        typeChipText: {
          fontSize: 11,
          fontWeight: '700',
          color: tokens.colors.primary.main,
        },
        emptyState: {
          alignItems: 'center',
          paddingTop: 72,
          paddingHorizontal: 28,
          gap: 10,
        },
        emptyIcon: {
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.04)',
          marginBottom: 4,
        },
        emptyText: {
          fontSize: 14,
          fontWeight: '500',
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          writingDirection: 'rtl',
          lineHeight: 20,
        },
        loadingWrap: {
          paddingVertical: 20,
          alignItems: 'center',
        },
      }),
    [tokens]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={styles.outer}>
        <ChatSessionBackdrop />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <DayNavBlurButton
              onPress={() => {
                void HapticFeedback.impactLight();
                onClose();
              }}
              glassIntensity="subtle"
              size={DRAWER_MENU_BUTTON_SIZE}
              accessibilityLabel="סגור"
            >
              <Ionicons name="close" size={22} color={tokens.colors.text.primary} />
            </DayNavBlurButton>

            <UICard
              variant="glass"
              glassIntensity="light"
              padding="none"
              style={styles.searchCard}
            >
              <View style={styles.searchInner}>
                <Ionicons name="search" size={18} color={tokens.colors.text.tertiary} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="חפש מניה: AAPL, Apple, NVDA…"
                  placeholderTextColor={tokens.colors.text.tertiary}
                  autoFocus
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {query ? (
                  <TouchableOpacity
                    onPress={() => {
                      void HapticFeedback.selection();
                      setQuery('');
                    }}
                    hitSlop={10}
                  >
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={tokens.colors.text.tertiary}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            </UICard>
          </View>

          <Text style={styles.hint}>מניות ו־ETF אמריקאיים · בלי בורסות זרות</Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={tokens.colors.primary.main} />
            </View>
          ) : null}

          {!loading && results.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="search-outline"
                  size={26}
                  color={tokens.colors.text.tertiary}
                />
              </View>
              <Text style={styles.emptyText}>
                {query
                  ? 'לא נמצאו מניות רלוונטיות. נסו סימבול אמריקאי (AAPL) או שם באנגלית.'
                  : 'הקלידו סימבול או שם חברה כדי להוסיף לרשימה.'}
              </Text>
            </View>
          ) : null}

          <FlatList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={results}
            keyExtractor={(item) => item.symbol}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  void HapticFeedback.impactLight();
                  onSelect(item);
                  onClose();
                }}
                style={({ pressed }) => [pressed && styles.rowPressed]}
              >
                <UICard
                  variant="glass"
                  glassIntensity="light"
                  padding="none"
                  style={styles.rowCard}
                  haptic={false}
                >
                  <View style={styles.rowInner}>
                    <TickerLogo symbol={item.symbol} size={40} />
                    <View style={styles.textBlock}>
                      <Text style={styles.symbolText}>
                        {item.display_symbol || item.symbol}
                      </Text>
                      <Text style={styles.descriptionText} numberOfLines={1}>
                        {item.description}
                      </Text>
                    </View>
                    <View style={styles.typeChip}>
                      <Text style={styles.typeChipText}>
                        {hebrewAssetTypeLabel(item.type)}
                      </Text>
                    </View>
                  </View>
                </UICard>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}
