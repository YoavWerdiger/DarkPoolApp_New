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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { ChatSessionBackdrop } from '../../../components/chat/ChatSessionBackdrop';
import {
  searchSymbols,
  type SymbolSearchResult,
} from '../../../services/portfolios/portfolioPriceFeed';
import { TickerLogo } from './TickerLogo';
import { HapticFeedback } from '../../../utils/hapticFeedback';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (result: SymbolSearchResult) => void;
}

/**
 * חיפוש סימבול עם autocomplete חי - debounce של 300ms.
 * משתמש ב-Finnhub /search (חינמי).
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
          backgroundColor: '#0A0E0A',
        },
        safe: {
          flex: 1,
          backgroundColor: 'transparent',
        },
        header: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 12,
        },
        searchBox: {
          flex: 1,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderRadius: 28,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        },
        searchInput: {
          flex: 1,
          fontSize: 15,
          color: tokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        closeBtn: {
          padding: 10,
          borderRadius: 24,
          backgroundColor: 'rgba(255,255,255,0.08)',
        },
        item: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: 16,
          marginHorizontal: 12,
          marginBottom: 8,
          borderRadius: 26,
          gap: 12,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        },
        symbolText: {
          fontSize: 15,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'right',
        },
        descriptionText: {
          fontSize: 12,
          color: tokens.colors.text.tertiary,
          marginTop: 2,
          textAlign: 'right',
        },
        typeChip: {
          paddingVertical: 5,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.06)',
        },
        typeChipText: {
          fontSize: 10,
          color: tokens.colors.text.tertiary,
        },
        emptyState: {
          alignItems: 'center',
          paddingTop: 80,
          paddingHorizontal: 30,
        },
        emptyText: {
          fontSize: 13,
          color: tokens.colors.text.tertiary,
          marginTop: 12,
          textAlign: 'center',
          lineHeight: 18,
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
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              void HapticFeedback.impactLight();
              onClose();
            }}
            hitSlop={10}
          >
            <Ionicons name="close" size={24} color={tokens.colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={tokens.colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="חפש סימבול: AAPL, MSFT, NVDA..."
              placeholderTextColor={tokens.colors.text.tertiary}
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
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
          </View>

        {loading ? (
          <View style={{ padding: 20 }}>
            <ActivityIndicator color={tokens.colors.primary.main} />
          </View>
        ) : null}

        {!loading && results.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="search-outline"
              size={40}
              color={tokens.colors.text.tertiary}
            />
            <Text style={styles.emptyText}>
              {query
                ? 'לא נמצאו תוצאות. נסה סימבול אחר או שם חברה באנגלית.'
                : 'הקלד שם חברה (Apple) או סימבול (AAPL) כדי לחפש.'}
            </Text>
          </View>
        ) : null}

          <FlatList
          style={{ flex: 1, backgroundColor: 'transparent' }}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: 24 }}
          data={results}
          keyExtractor={(item) => item.symbol}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                void HapticFeedback.impactLight();
                onSelect(item);
                onClose();
              }}
              activeOpacity={0.85}
            >
              <TickerLogo symbol={item.symbol} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.symbolText}>{item.display_symbol}</Text>
                <Text style={styles.descriptionText} numberOfLines={1}>
                  {item.description}
                </Text>
              </View>
              <View style={styles.typeChip}>
                <Text style={styles.typeChipText}>{item.type}</Text>
              </View>
            </TouchableOpacity>
          )}
          keyboardShouldPersistTaps="handled"
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}
