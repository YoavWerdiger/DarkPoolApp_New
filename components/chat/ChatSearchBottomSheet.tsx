import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBottomSheetClose } from '../ui/BottomSheet/BottomSheet';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import {
  ChatBottomSheet,
  ChatSheetEmptyState,
  ChatSheetLoading,
  useChatSheetStyles,
} from './ChatBottomSheet';
import { searchMessagesInGroup } from '../../services/chat/chatSearchService';
import { ChatMessage } from '../../types/chat.types';
import { getChatMessagePreview } from '../../utils/chatMessagePreview';
import { format, isToday, isYesterday } from 'date-fns';
import { he } from 'date-fns/locale';
import { chatRtlText } from './chatDesignTokens';

interface ChatSearchBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  onMessagePress: (messageId: string) => void;
}

const SHEET_BORDER = 'rgba(255, 255, 255, 0.10)';

export default function ChatSearchBottomSheet({
  visible,
  onClose,
  groupId,
  onMessagePress,
}: ChatSearchBottomSheetProps) {
  const tokens = useDesignTokens();
  const sheet = useChatSheetStyles();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const animatedClose = useBottomSheetClose();
  const handleHeaderClose = useCallback(() => {
    (animatedClose ?? onClose)();
  }, [animatedClose, onClose]);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const { data, error } = await searchMessagesInGroup(groupId, searchTerm.trim(), 50);
      if (!isMountedRef.current) return;

      if (error) {
        setSearchResults([]);
      } else {
        setSearchResults(data || []);
      }
    } catch {
      if (!isMountedRef.current) return;
      setSearchResults([]);
    } finally {
      if (isMountedRef.current) setIsSearching(false);
    }
  }, [groupId, searchTerm]);

  const handleClear = () => {
    setSearchTerm('');
    setSearchResults([]);
    setHasSearched(false);
    searchInputRef.current?.focus();
  };

  const sanitizeSearchInput = (text: string) =>
    text
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[\u202A-\u202E]/g, '');

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        try {
          searchInputRef.current?.focus();
        } catch {
          /* non-critical */
        }
      }, 450);
      return () => clearTimeout(timer);
    }
    setSearchTerm('');
    setSearchResults([]);
    setHasSearched(false);
  }, [visible]);

  const formatMessageDate = (date: Date): string => {
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'אתמול';
    return format(date, 'd בMMMM yyyy', { locale: he });
  };

  const highlightText = (text: string, term: string): React.ReactNode => {
    if (!term.trim() || !text) return text;

    try {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = text.split(new RegExp(`(${escapedTerm})`, 'gi'));

      return (
        <Text>
          {parts.map((part, index) => {
            const uniqueKey = `${part}-${index}-${text.length}`;
            if (part.toLowerCase() === term.toLowerCase()) {
              return (
                <Text key={uniqueKey} style={sheet.resultHighlight}>
                  {part}
                </Text>
              );
            }
            return <Text key={uniqueKey}>{part}</Text>;
          })}
        </Text>
      );
    } catch {
      return text;
    }
  };

  const renderSearchResult = ({ item }: { item: ChatMessage }) => {
    const messageDate = new Date(item.created_at);
    const senderName = (item.sender as { display_name?: string })?.display_name || 'משתמש';

    return (
      <Pressable
        style={({ pressed }) => [styles.resultItem, pressed && { opacity: 0.75 }]}
        onPress={() => {
          onMessagePress(item.id);
          onClose();
        }}
      >
        <View style={sheet.resultHeader}>
          <Text style={sheet.resultSender}>{senderName}</Text>
          <Text style={sheet.resultDate}>{formatMessageDate(messageDate)}</Text>
        </View>
        <Text style={sheet.resultBody} numberOfLines={2}>
          {item.message_type && item.message_type !== 'text'
            ? getChatMessagePreview(item.message_type, item.content)
            : highlightText(item.content || '', searchTerm)}
        </Text>
      </Pressable>
    );
  };

  const canSearch = searchTerm.trim().length > 0 && !isSearching;

  const resultsBody = useMemo(() => {
    if (isSearching) {
      return <ChatSheetLoading label="מחפש..." />;
    }
    if (hasSearched) {
      if (searchResults.length > 0) {
        return (
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            style={styles.resultsList}
            contentContainerStyle={styles.resultsListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          />
        );
      }
      return (
        <ChatSheetEmptyState
          icon="search-outline"
          title="לא נמצאו תוצאות"
          subtitle="נסה מילים אחרות"
        />
      );
    }
    return (
      <ChatSheetEmptyState
        icon="search-outline"
        title="הזן מילת חיפוש"
        subtitle="חפש הודעות בקבוצה זו"
      />
    );
  }, [hasSearched, isSearching, searchResults, searchTerm, sheet, styles]);

  return (
    <ChatBottomSheet visible={visible} onClose={onClose} snapPoints={[0.92]} showBrandWatermark={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <DayNavBlurButton
            onPress={handleHeaderClose}
            size={DAY_NAV_BUTTON_SIZE}
            glassIntensity="subtle"
            accessibilityLabel="סגור"
          >
            <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
          </DayNavBlurButton>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: tokens.colors.text.primary }]}>חיפוש הודעות</Text>
            <Text style={[styles.headerSubtitle, { color: tokens.colors.text.secondary }]}>
              חפש לפי תוכן ההודעה
            </Text>
          </View>

          <View style={styles.headerSideSpacer} />
        </View>

        <UICard variant="inputGlass" padding="none" style={styles.searchShell}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={tokens.colors.text.tertiary} />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, { color: tokens.colors.text.primary }]}
              placeholder="חפש הודעות..."
              placeholderTextColor={tokens.colors.text.tertiary}
              value={searchTerm}
              onChangeText={(text) => setSearchTerm(sanitizeSearchInput(text))}
              onSubmitEditing={() => void handleSearch()}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="none"
            />
            {searchTerm.length > 0 ? (
              <Pressable
                onPress={handleClear}
                hitSlop={8}
                style={({ pressed }) => pressed && { opacity: 0.6 }}
              >
                <Ionicons name="close-circle" size={18} color={tokens.colors.text.tertiary} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => void handleSearch()}
              disabled={!canSearch}
              style={({ pressed }) => [
                styles.searchAction,
                !canSearch && styles.searchActionDisabled,
                pressed && canSearch && { opacity: 0.85 },
              ]}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="search" size={17} color="#fff" />
              )}
            </Pressable>
          </View>
        </UICard>

        <View style={styles.resultsWrap}>{resultsBody}</View>
      </View>
    </ChatBottomSheet>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 280,
      paddingHorizontal: tokens.spacing.md,
      direction: 'rtl',
      backgroundColor: 'transparent',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: SHEET_BORDER,
      gap: 10,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerSideSpacer: {
      width: DAY_NAV_BUTTON_SIZE,
      height: DAY_NAV_BUTTON_SIZE,
    },
    headerTitle: {
      ...chatRtlText,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.35,
      textAlign: 'center',
      width: '100%',
    },
    headerSubtitle: {
      ...chatRtlText,
      marginTop: 4,
      fontSize: 13,
      fontWeight: '500',
      textAlign: 'center',
      width: '100%',
    },
    searchShell: {
      marginTop: 14,
      marginBottom: 12,
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 14,
      paddingVertical: 4,
    },
    searchRow: {
      flexDirection: 'row',
      direction: 'rtl',
      alignItems: 'center',
      gap: 10,
      minHeight: 44,
    },
    searchInput: {
      flex: 1,
      ...chatRtlText,
      fontSize: 16,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      backgroundColor: 'transparent',
    },
    searchAction: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: tokens.colors.primary.main,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    searchActionDisabled: {
      backgroundColor: 'rgba(255,255,255,0.08)',
      opacity: 0.55,
    },
    resultsWrap: {
      flex: 1,
      minHeight: 0,
    },
    resultsList: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    resultsListContent: {
      flexGrow: 1,
      paddingBottom: 12,
    },
    resultItem: {
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: SHEET_BORDER,
    },
  });
