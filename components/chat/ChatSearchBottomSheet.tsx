import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { useBottomSheetClose } from '../ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import { searchMessagesInGroup } from '../../services/chat/chatSearchService';
import { ChatMessage } from '../../types/chat.types';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { he } from 'date-fns/locale';

interface ChatSearchBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  onMessagePress: (messageId: string) => void;
}

export default function ChatSearchBottomSheet({
  visible,
  onClose,
  groupId,
  onMessagePress,
}: ChatSearchBottomSheetProps) {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
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
    return () => { isMountedRef.current = false; };
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
    } catch (error) {
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
  };

  // Focus input when bottom sheet opens (with delay to avoid crash)
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        try {
          searchInputRef.current?.focus();
        } catch (error) {
          /* focus failed - non-critical */
        }
      }, 500); // Increased delay to 500ms
      return () => clearTimeout(timer);
    } else {
      // Reset when closing
      setSearchTerm('');
      setSearchResults([]);
      setHasSearched(false);
    }
  }, [visible]);

  const formatMessageDate = (date: Date): string => {
    if (isToday(date)) {
      return format(date, 'HH:mm');
    }
    if (isYesterday(date)) {
      return 'אתמול';
    }
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
            // יצירת key ייחודי על בסיס התוכן והמיקום
            const uniqueKey = `${part}-${index}-${text.length}`;
            if (part.toLowerCase() === term.toLowerCase()) {
              return (
                <Text key={uniqueKey} style={styles.highlight}>
                  {part}
                </Text>
              );
            }
            return <Text key={uniqueKey}>{part}</Text>;
          })}
        </Text>
      );
    } catch (error) {
      return text;
    }
  };

  const renderSearchResult = ({ item }: { item: ChatMessage }) => {
    const messageDate = new Date(item.created_at);
    const senderName = (item.sender as any)?.display_name || 'משתמש';

    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => {
          onMessagePress(item.id);
          onClose();
        }}
        activeOpacity={0.7}
      >
        <View style={styles.resultHeader}>
          <Text style={styles.senderName}>{senderName}</Text>
          <Text style={styles.messageDate}>{formatMessageDate(messageDate)}</Text>
        </View>
        <Text style={styles.messageContent} numberOfLines={2}>
          {highlightText(item.content || '', searchTerm)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.9]}
      showHandle={true}
      enablePanDownToClose={true}
      useModal={true}
      backdropOpacity={0.4}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <DayNavBlurButton
            onPress={handleHeaderClose}
            size={DAY_NAV_BUTTON_SIZE}
            glassIntensity="subtle"
            style={styles.closeButton}
            accessibilityLabel="חזרה"
          >
            <Ionicons name="chevron-forward" size={22} color={DesignTokens.colors.text.primary} />
          </DayNavBlurButton>
          <Text style={styles.title}>חיפוש הודעות</Text>
          <View style={styles.spacer} />
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons
              name="search"
              size={20}
              color={DesignTokens.colors.text.secondary}
              style={styles.searchIcon}
            />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="חפש הודעות..."
              placeholderTextColor={DesignTokens.colors.text.secondary}
              value={searchTerm}
              onChangeText={(text) => {
                // הגנה מפני rich text - רק טקסט רגיל
                // הסר תווים מיוחדים שעלולים לגרום לבעיות
                const plainText = text
                  .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Control characters
                  .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width characters
                  .replace(/[\u202A-\u202E]/g, ''); // Bidirectional override characters
                setSearchTerm(plainText);
              }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="never"
              keyboardType="default"
              textContentType="none"
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={DesignTokens.colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.searchButton, !searchTerm.trim() && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={!searchTerm.trim() || isSearching}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color={DesignTokens.colors.text.primary} />
            ) : (
              <Ionicons name="search" size={20} color={DesignTokens.colors.text.primary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Results */}
        <View style={styles.resultsContainer}>
          {isSearching ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={DesignTokens.colors.accent.main} />
              <Text style={styles.loadingText}>מחפש...</Text>
            </View>
          ) : hasSearched ? (
            searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id}
                style={styles.resultsList}
                contentContainerStyle={styles.resultsListContent}
                showsVerticalScrollIndicator={true}
              />
            ) : (
              <View style={styles.centerContainer}>
                <Ionicons
                  name="search-outline"
                  size={64}
                  color={DesignTokens.colors.text.secondary}
                />
                <Text style={styles.emptyText}>לא נמצאו תוצאות</Text>
                <Text style={styles.emptySubtext}>נסה לנסות מילים אחרות</Text>
              </View>
            )
          ) : (
            <View style={styles.centerContainer}>
              <Ionicons
                name="search-outline"
                size={64}
                color={DesignTokens.colors.text.secondary}
              />
              <Text style={styles.emptyText}>הזן מילת חיפוש</Text>
              <Text style={styles.emptySubtext}>חפש הודעות בקבוצה זו</Text>
            </View>
          )}
        </View>
      </View>
    </BottomSheet>
  );
}

const createStyles = (tokens: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: tokens.layout.borderWidth.normal,
    borderBottomColor: tokens.colors.border.divider,
  },
  closeButton: {
    alignSelf: 'center',
  },
  title: {
    flex: 1,
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
    textAlign: 'center',
  },
  spacer: {
    width: tokens.layout.screenPadding * 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: tokens.borderRadius.md,
    paddingHorizontal: tokens.spacing.sm,
    borderWidth: tokens.layout.borderWidth.normal,
    borderColor: tokens.colors.border.primary,
  },
  searchIcon: {
    marginRight: tokens.spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: tokens.typography.titleXs.size,
    color: tokens.colors.text.primary,
    paddingVertical: tokens.spacing.sm,
    textAlign: 'right',
  },
  clearButton: {
    padding: tokens.spacing.xs,
  },
  searchButton: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.accent.main,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  searchButtonDisabled: {
    backgroundColor: tokens.colors.background.tertiary,
    opacity: 0.5,
  },
  resultsContainer: {
    flex: 1,
  },
  resultsList: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  resultsListContent: {
    flexGrow: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    paddingBottom: tokens.spacing.lg,
  },
  resultItem: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.sm,
    borderBottomWidth: tokens.layout.borderWidth.normal,
    borderBottomColor: tokens.colors.border.divider,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  senderName: {
    fontSize: tokens.typography.bodySmall.size,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
  },
  messageDate: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
  },
  messageContent: {
    fontSize: tokens.typography.titleXs.size,
    color: tokens.colors.text.primary,
    lineHeight: 22,
  },
  highlight: {
    backgroundColor: tokens.colors.accent.main + '40',
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xl * 2,
  },
  loadingText: {
    marginTop: tokens.spacing.md,
    fontSize: tokens.typography.titleXs.size,
    color: tokens.colors.text.secondary,
  },
  emptyText: {
    marginTop: tokens.spacing.md,
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
  },
  emptySubtext: {
    marginTop: tokens.spacing.xs,
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.secondary,
  },
});

