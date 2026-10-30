/**
 * שיט בחירת מניות (התראות דיווחי רווח): חיפוש עם מקלדת שנפתחת בתוך השיט, תוצאות חיות
 * עם לוגו ושם החברה, וכפתור הוספה / הסרה בכל שורה. נשאר פתוח — אפשר להוסיף כמה ברצף.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Check, Plus } from 'lucide-react-native';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { ChatSheetTopoHeader } from '../chat/ChatBottomSheet';
import { useDesignTokens } from '../ui/DesignTokens';
import { LIGHT_CANVAS } from '../ui/designTokensStatic';
import { formFieldShellStyle } from '../ui/formControl';
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';
import { APP_LAYOUT } from '../ui/appLayout';
import UICard from '../ui/UICard';
import { searchSymbols, type SymbolSearchResult } from '../../services/portfolios/portfolioPriceFeed';
import { TickerLogo } from '../../screens/Portfolios/components/TickerLogo';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  selected: string[];
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
};

export function TickerPickSheet({ isOpen, onClose, title = 'הוספת מניות', selected, onAdd, onRemove }: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      const r = await searchSymbols(q);
      setResults(r.slice(0, 20));
      setLoading(false);
    }, 280);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  const selectedSet = useMemo(() => new Set(selected.map((s) => s.toUpperCase())), [selected]);

  // טיקר שהוקלד בדיוק ולא חזר בחיפוש — עדיין אפשר להוסיף אותו
  const typed = query.trim().toUpperCase();
  const rows: SymbolSearchResult[] =
    typed && /^[A-Z.\-]{1,6}$/.test(typed) && !results.some((r) => r.symbol.toUpperCase() === typed)
      ? [{ symbol: typed, display_symbol: typed, description: '', type: '' }, ...results]
      : results;

  const toggle = (symbol: string) => {
    const sym = symbol.toUpperCase();
    void HapticFeedback.selection();
    if (selectedSet.has(sym)) onRemove(sym);
    else onAdd(sym);
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={[0.9]}
      edgeToEdge
      showHandle
      enablePanDownToClose
      showBrandBackground={false}
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
      contentPaddingBottom={0}
    >
      <View style={styles.root}>
        <ChatSheetTopoHeader title={title} onClose={onClose} />
        <View style={[styles.searchShell, formFieldShellStyle({ tokens, focused, multiline: false })]}>
          <Ionicons name="search" size={18} color={tokens.colors.text.secondary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => {
              if (rows[0]) toggle(rows[0].symbol);
            }}
            placeholder="טיקר או שם חברה"
            placeholderTextColor={tokens.colors.text.tertiary}
            keyboardAppearance={(tokens.colors.background.primary as string) === LIGHT_CANVAS ? 'light' : 'dark'}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            autoFocus
            returnKeyType="done"
            blurOnSubmit={false}
            accessibilityLabel="חיפוש מניה"
          />
          {loading ? (
            <ActivityIndicator size="small" color={tokens.colors.text.secondary} />
          ) : query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="נקה חיפוש">
              <Ionicons name="close-circle" size={18} color={tokens.colors.text.secondary} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {rows.length ? (
            <UICard variant="soft" glassIntensity="light" padding="none">
              {rows.map((r, i) => {
                const sym = r.symbol.toUpperCase();
                const on = selectedSet.has(sym);
                return (
                  <Pressable
                    key={sym}
                    onPress={() => toggle(sym)}
                    style={[styles.row, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: tokens.colors.border.divider }]}
                    accessibilityRole="button"
                    accessibilityLabel={on ? `הסרת ${sym}` : `הוספת ${sym}`}
                  >
                    <TickerLogo symbol={sym} size={36} borderRadius={18} />
                    <View style={styles.rowText}>
                      <Text style={styles.symbol} numberOfLines={1}>
                        {r.display_symbol || sym}
                      </Text>
                      {r.description ? (
                        <Text style={styles.desc} numberOfLines={1}>
                          {r.description}
                        </Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.addBtn,
                        { backgroundColor: on ? tokens.colors.primary.main : tokens.colors.background.cardSolid },
                      ]}
                    >
                      {on ? (
                        <Check size={16} color={tokens.colors.text.inverse} strokeWidth={2.6} />
                      ) : (
                        <Plus size={16} color={tokens.colors.primary.main} strokeWidth={2.6} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </UICard>
          ) : query.trim() && !loading ? (
            <Text style={styles.empty}>לא נמצאו מניות</Text>
          ) : null}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    root: { flex: 1, direction: 'rtl', paddingHorizontal: tokens.layout.screenPadding, paddingTop: 4 },
    searchShell: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      paddingHorizontal: 16,
      gap: APP_LAYOUT.stackGapSmall,
      borderRadius: tokens.borderRadius.search,
      marginBottom: tokens.spacing.md,
    },
    searchInput: {
      ...APP_TYPE.body,
      ...appPhysicalRightText,
      flex: 1,
      color: tokens.colors.text.primary,
      padding: 0,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 48 },
    row: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 60,
      paddingVertical: 10,
      paddingHorizontal: APP_LAYOUT.cardPadding,
    },
    rowText: { flex: 1, minWidth: 0, gap: 2 },
    symbol: { ...APP_TYPE.body, fontWeight: '600', color: tokens.colors.text.primary, ...appPhysicalRightText },
    desc: { ...APP_TYPE.caption, color: tokens.colors.text.secondary, ...appPhysicalRightText },
    addBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    empty: { ...APP_TYPE.body, ...appPhysicalRightText, color: tokens.colors.text.secondary, paddingVertical: tokens.spacing.lg },
  });
}
