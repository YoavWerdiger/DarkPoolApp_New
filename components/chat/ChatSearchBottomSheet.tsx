import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBottomSheetClose } from '../ui/BottomSheet/BottomSheet';
import {
  ChatBottomSheet,
  ChatSheetContent,
  ChatSheetNavHeader,
  ChatSheetSearchBar,
  ChatSheetEmptyState,
  ChatSheetLoading,
  useChatSheetStyles,
} from './ChatBottomSheet';
import { searchMessagesInGroup } from '../../services/chat/chatSearchService';
import { ChatMessage } from '../../types/chat.types';
import { format, isToday, isYesterday } from 'date-fns';
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
  const sheet = useChatSheetStyles();
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
        style={({ pressed }) => [sheet.resultItem, pressed && { opacity: 0.75 }]}
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
          {highlightText(item.content || '', searchTerm)}
        </Text>
      </Pressable>
    );
  };

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
  }, [hasSearched, isSearching, searchResults, searchTerm, sheet]);

  return (
    <ChatBottomSheet visible={visible} onClose={onClose} snapPoints={[0.92]}>
      <ChatSheetContent style={styles.content}>
        <ChatSheetNavHeader title="חיפוש הודעות" onClose={handleHeaderClose} />

        <ChatSheetSearchBar
          inputRef={searchInputRef}
          value={searchTerm}
          onChangeText={(text) => setSearchTerm(sanitizeSearchInput(text))}
          onSubmit={handleSearch}
          onSearchPress={handleSearch}
          onClear={handleClear}
          placeholder="חפש הודעות..."
          loading={isSearching}
          searchDisabled={!searchTerm.trim()}
        />

        <View style={styles.resultsWrap}>{resultsBody}</View>
      </ChatSheetContent>
    </ChatBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    minHeight: 280,
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
});
