import React, { useEffect, useMemo, useRef, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDesignTokens } from "../../../components/ui/DesignTokens";
import { LIGHT_CANVAS } from "../../../components/ui/designTokensStatic";
import { SheetSurfaceProvider } from "../../../components/ui/BottomSheet/sheetSurface";
import { APP_TYPE } from "../../../components/ui/appType";
import { APP_LAYOUT } from "../../../components/ui/appLayout";
import {
  DayNavBlurButton,
  DRAWER_MENU_BUTTON_SIZE,
} from "../../../components/ui/DayNavBlurButton";
import {
  searchSymbols,
  type SymbolSearchResult,
} from "../../../services/portfolios/portfolioPriceFeed";
import { hebrewAssetTypeLabel } from "../../../services/portfolios/symbolSearchFilter";
import { TickerLogo } from "./TickerLogo";
import { HapticFeedback } from "../../../utils/hapticFeedback";

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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery("");
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
          backgroundColor: tokens.colors.background.cardSolid,
          direction: "rtl",
        },
        safe: {
          flex: 1,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          paddingTop: APP_LAYOUT.cardPadding,
          paddingBottom: APP_LAYOUT.stackGapSmall,
          gap: APP_LAYOUT.stackGapSmall,
        },
        title: {
          ...APP_TYPE.screenTitle,
          flex: 1,
          textAlign: "center",
          writingDirection: "rtl",
          color: tokens.colors.text.primary,
        },
        headerSide: {
          width: DRAWER_MENU_BUTTON_SIZE,
        },
        searchWrap: {
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          paddingTop: APP_LAYOUT.stackGapSmall,
        },
        searchInner: {
          flexDirection: "row",
          alignItems: "center",
          height: 48,
          paddingHorizontal: APP_LAYOUT.cardPadding,
          gap: APP_LAYOUT.stackGapSmall,
          borderRadius: tokens.borderRadius.full,
          backgroundColor: tokens.colors.background.primary,
        },
        searchInput: {
          ...APP_TYPE.cardBody,
          flex: 1,
          color: tokens.colors.text.primary,
          textAlign: "right",
          writingDirection: "rtl",
          padding: 0,
        },
        list: {
          flex: 1,
        },
        listContent: {
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          paddingTop: APP_LAYOUT.stackGapSmall,
          paddingBottom: APP_LAYOUT.sectionGap,
        },
        divider: {
          height: 1,
          backgroundColor: tokens.colors.border.divider,
        },
        rowInner: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: APP_LAYOUT.cardTitleToBodyGap,
          gap: APP_LAYOUT.cardTitleToBodyGap,
        },
        rowPressed: {
          opacity: 0.7,
        },
        textBlock: {
          flex: 1,
          minWidth: 0,
          alignItems: "flex-start",
        },
        symbolText: {
          ...APP_TYPE.cardBody,
          fontWeight: APP_TYPE.cardTitle.fontWeight,
          color: tokens.colors.text.primary,
          writingDirection: "ltr",
          textAlign: "left",
        },
        descriptionText: {
          ...APP_TYPE.caption,
          color: tokens.colors.text.secondary,
          textAlign: "left",
          writingDirection: "ltr",
        },
        typeChip: {
          height: 24,
          justifyContent: "center",
          paddingHorizontal: 10,
          borderRadius: tokens.borderRadius.full,
          backgroundColor: tokens.colors.background.primary,
        },
        typeChipText: {
          ...APP_TYPE.cardMetricLabel,
          color: tokens.colors.text.secondary,
        },
        emptyState: {
          alignItems: "center",
          paddingTop: APP_LAYOUT.sectionGap * 2,
          paddingHorizontal: APP_LAYOUT.sectionGap,
          gap: APP_LAYOUT.componentGap,
        },
        emptyIcon: {
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tokens.colors.background.primary,
        },
        emptyText: {
          ...APP_TYPE.cardBody,
          color: tokens.colors.text.secondary,
          textAlign: "center",
          writingDirection: "rtl",
        },
        loadingWrap: {
          paddingVertical: APP_LAYOUT.componentGap,
          alignItems: "center",
        },
      }),
    [tokens],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SheetSurfaceProvider>
        <View style={styles.outer}>
          <SafeAreaView style={styles.safe} edges={["bottom"]}>
            <View style={styles.header}>
              <View style={styles.headerSide} />
              <Text style={styles.title}>הוספת מניה</Text>
              <DayNavBlurButton
                onPress={() => {
                  void HapticFeedback.impactLight();
                  onClose();
                }}
                size={DRAWER_MENU_BUTTON_SIZE}
                accessibilityLabel="סגור"
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={tokens.colors.text.primary}
                />
              </DayNavBlurButton>
            </View>

            <View style={styles.searchWrap}>
              <View style={styles.searchInner}>
                <Ionicons
                  name="search"
                  size={18}
                  color={tokens.colors.text.secondary}
                />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="חפש מניה: AAPL, Apple, NVDA…"
                  placeholderTextColor={tokens.colors.text.tertiary}
                  keyboardAppearance={
                    tokens.colors.background.primary === LIGHT_CANVAS
                      ? "light"
                      : "dark"
                  }
                  autoFocus
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {query ? (
                  <TouchableOpacity
                    onPress={() => {
                      void HapticFeedback.selection();
                      setQuery("");
                    }}
                    hitSlop={10}
                  >
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={tokens.colors.text.secondary}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>


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
                    color={tokens.colors.text.secondary}
                  />
                </View>
                <Text style={styles.emptyText}>
                  {query
                    ? "לא נמצאו מניות רלוונטיות. נסו סימבול אמריקאי (AAPL) או שם באנגלית."
                    : "הקלידו סימבול או שם חברה כדי להוסיף לרשימה."}
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
              ItemSeparatorComponent={() => <View style={styles.divider} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    onSelect(item);
                    onClose();
                  }}
                  style={({ pressed }) => [pressed && styles.rowPressed]}
                >
                  <View style={styles.rowInner}>
                    <TickerLogo symbol={item.symbol} size={36} />
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
                </Pressable>
              )}
            />
          </SafeAreaView>
        </View>
      </SheetSurfaceProvider>
    </Modal>
  );
}
