import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  SectionList,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useDesignTokens } from '../ui/DesignTokens';
import { ChatSheetTopoHeader, useChatSheetDismiss, useChatSheetStyles } from './ChatBottomSheet';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { APP_LAYOUT } from '../ui/appLayout';
import { APP_TYPE } from '../ui/appType';
import { formFieldInputStyle, formFieldPlaceholderColor, formFieldShellStyle } from '../ui/formControl';
import {
  REACTION_EMOJI_CATEGORIES,
  emojiSearchHaystack,
} from './reactionEmojiData';
import { chatRtlRow, chatRtlText } from './chatDesignTokens';

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onReaction: (emoji: string) => void;
  messageReactions?: Array<{ emoji: string; reacted_by_me: boolean }>;
  /** כותרת השיט. ברירת מחדל: בחירת ריאקציה. */
  title?: string;
  /**
   * בתוך מודאל שכבר פתוח (פריוויו לפני שליחה) — בלי Modal נוסף,
   * כדי שהבורר יישב מעל התמונה והכיתוב.
   */
  embedded?: boolean;
}

/** פריט SectionList — תמיד אובייקט עם מערך אימוג'ים (לא string[] גולמי). */
type EmojiRow = {
  id: string;
  emojis: string[];
};

type EmojiSection = {
  title: string;
  key: string;
  data: EmojiRow[];
};

const COLS = 8;
const EMOJI_BTN = 44;

/** מחלץ מערך אימוג'ים בבטחה — תומך גם בצורה הישנה (item = string[]) למקרה Hot Reload. */
function resolveRowEmojis(item: EmojiRow | string[] | null | undefined): string[] {
  if (Array.isArray(item)) {
    return item.filter((e): e is string => typeof e === 'string' && e.length > 0);
  }
  if (item && Array.isArray(item.emojis)) {
    return item.emojis.filter((e): e is string => typeof e === 'string' && e.length > 0);
  }
  return [];
}

function resolveRowId(item: EmojiRow | string[] | null | undefined, index: number): string {
  if (item && !Array.isArray(item) && typeof item.id === 'string' && item.id) {
    return item.id;
  }
  return `emoji-row-${index}`;
}

export default function ReactionPicker({
  visible,
  onClose,
  onReaction,
  messageReactions = [],
  title = 'בחר ריאקציה',
  embedded = false,
}: ReactionPickerProps) {
  const sheet = useChatSheetStyles();
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const dismiss = useChatSheetDismiss(onClose);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const emojiBtnWidth = useMemo(() => {
    // paddingHorizontal 16 * 2 על ה-root
    const inner = Math.max(windowWidth - APP_LAYOUT.screenPaddingHorizontal * 2, 280);
    return Math.floor(inner / COLS);
  }, [windowWidth]);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const selectedSet = useMemo(() => {
    const set = new Set<string>();
    for (const r of messageReactions) {
      if (r.reacted_by_me) set.add(r.emoji);
    }
    return set;
  }, [messageReactions]);

  const sections = useMemo<EmojiSection[]>(() => {
    const q = query.trim().toLowerCase();
    const out: EmojiSection[] = [];

    for (const cat of REACTION_EMOJI_CATEGORIES) {
      let emojis = cat.emojis;
      if (q) {
        const catHit =
          cat.title.toLowerCase().includes(q) ||
          (cat.keywords ?? []).some((k) => k.toLowerCase().includes(q));
        if (!catHit) {
          emojis = emojis.filter((e) =>
            emojiSearchHaystack(e, cat.title).includes(q),
          );
        }
      }
      if (emojis.length === 0) continue;
      out.push({
        title: cat.title,
        key: cat.id,
        data: [{ id: cat.id, emojis }],
      });
    }

    return out;
  }, [query]);

  const handleReaction = useCallback(
    (emoji: string) => {
      void HapticFeedback.selection();
      onReaction(emoji);
      dismiss();
    },
    [dismiss, onReaction],
  );

  const listMaxHeight = Math.round(windowHeight * 0.58);
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 8);

  return (
    // שיט לפי הטופו (כמו 3 הנקודות ביומן): קנבס ערכת הנושא, כותרת עם שברון, שדה חיפוש formField
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.72]}
      edgeToEdge
      showHandle
      enablePanDownToClose
      useModal={!embedded}
      showBrandBackground={false}
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
      avoidKeyboard={!embedded}
      contentPaddingBottom={0}
    >
      <View style={[styles.root, { paddingBottom: bottomPad, direction: 'rtl' }]}>
        <ChatSheetTopoHeader title={title} onClose={onClose} />

        <View
          style={[
            formFieldShellStyle({ tokens, focused: false }),
            styles.searchField,
            styles.searchFieldGap,
          ]}
        >
          <Ionicons name="search" size={18} color={tokens.colors.text.secondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="חיפוש אימוג'י..."
            placeholderTextColor={formFieldPlaceholderColor(tokens)}
            style={[formFieldInputStyle(tokens), styles.searchInput]}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            returnKeyType="search"
            textContentType="none"
            accessibilityLabel="חיפוש אימוג'י"
          />
          {query.length > 0 ? (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={8}
              accessibilityLabel="נקה חיפוש"
            >
              <Ionicons name="close-circle" size={18} color={tokens.colors.text.tertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item, index) => resolveRowId(item, index)}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: listMaxHeight }}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: tokens.colors.text.tertiary }]}>לא נמצאו אימוג'ים</Text>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: tokens.colors.text.secondary },
                ]}
              >
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item, index }) => {
            const rowEmojis = resolveRowEmojis(item);
            if (rowEmojis.length === 0) return null;
            const rowId = resolveRowId(item, index);
            return (
              <View style={styles.grid}>
                {rowEmojis.map((emoji) => {
                  const isSelected = selectedSet.has(emoji);
                  return (
                    <TouchableOpacity
                      key={`${rowId}-${emoji}`}
                      activeOpacity={0.65}
                      onPress={() => handleReaction(emoji)}
                      style={[
                        styles.emojiBtn,
                        { width: emojiBtnWidth },
                        isSelected && sheet.emojiButtonSelected,
                      ]}
                      accessibilityLabel={`ריאקציה ${emoji}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text style={styles.emoji}>{emoji}</Text>
                      {isSelected ? (
                        <View style={sheet.emojiSelectedBadge}>
                          <Text style={sheet.emojiSelectedBadgeText}>✓</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          }}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    flexGrow: 0,
  },
  searchFieldGap: {
    marginTop: APP_LAYOUT.cardTitleToBodyGap,
    marginBottom: 6,
  },
  searchField: {
    ...chatRtlRow,
    direction: 'ltr',
    flexDirection: 'row',
    gap: 8,
    borderRadius: 9999,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  searchInput: {
    minHeight: 48,
  },
  listContent: {
    paddingBottom: 8,
    paddingTop: 2,
  },
  sectionHeader: {
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: 'transparent',
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'flex-end',
  },
  sectionTitle: {
    writingDirection: 'rtl',
    textAlign: 'right',
    alignSelf: 'flex-end',
    fontSize: APP_TYPE.cardMetricLabel.fontSize,
    fontWeight: APP_TYPE.cardMetricLabel.fontWeight,
    lineHeight: APP_TYPE.cardMetricLabel.lineHeight,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  emojiBtn: {
    height: EMOJI_BTN,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  emoji: {
    fontSize: 26,
  },
  emptyText: {
    ...chatRtlText,
    textAlign: 'center',
    paddingVertical: 28,
    fontSize: 15,
  },
});
